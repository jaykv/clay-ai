import React, { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { getTraces, clearTraces, OtelSpan, TraceData, PaginationData, otelSpanToTraceData } from '@/lib/api/traces';
import { wsClient, ConnectionStatus } from '@/lib/api/websocket';

// Using the OtelSpan interface imported from api/traces

const TracesList: React.FC = () => {
  const [traces, setTraces] = useState<OtelSpan[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 50, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  // Convert OtelSpan to TraceData for display
  const convertedTraces = traces.map(otelSpanToTraceData);

  const loadTraces = useCallback(async (page = pagination.page, limit = pagination.limit) => {
    try {
      setLoading(true);
      setError(null);

      // Set a timeout to show loading state for at least 500ms
      // This prevents flickering if data loads very quickly
      const loadingTimer = setTimeout(() => {}, 500);

      const data = await getTraces(page, limit);
      setTraces(data.traces);
      setPagination(data.pagination);

      clearTimeout(loadingTimer);
    } catch (err) {
      // Only show error if we don't have any traces yet
      if (traces.length === 0) {
        setError('Failed to load traces. Make sure the proxy server is running.');
      }
      console.error(err);
    } finally {
      // Add a small delay before hiding the loading indicator
      // to prevent UI flickering
      setTimeout(() => {
        setLoading(false);
      }, 300);
    }
  }, [pagination.page, pagination.limit, traces.length]);

  const handleClearTraces = async () => {
    try {
      setLoading(true);
      await clearTraces();
      setTraces([]);
      setSelectedTrace(null);
    } catch (err) {
      setError('Failed to clear traces.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle new traces coming in via WebSocket
  const handleNewTrace = useCallback((message: any) => {
    if (message.data) {
      // Add the new trace to the beginning of the array
      setTraces(prevTraces => [message.data, ...prevTraces.slice(0, 49)]);

      // Update pagination total
      setPagination(prev => ({
        ...prev,
        total: prev.total + 1
      }));

      // Clear any errors when we get data
      setError(null);
    }
  }, []);

  // Handle traces update via WebSocket
  const handleTracesUpdate = useCallback((message: any) => {
    if (message.data) {
      setTraces(message.data.traces);
      setPagination(message.data.pagination);
      setLoading(false);
      setError(null); // Clear any errors when we get data
    }
  }, []);

  // Initialize WebSocket connection and listeners
  useEffect(() => {
    // Set up status listener
    wsClient.onStatusChange(setConnectionStatus);

    // Set up WebSocket listeners
    wsClient.on('newTrace', handleNewTrace);
    wsClient.on('traces', handleTracesUpdate);

    // Initial load of traces
    loadTraces();

    // Set up polling for traces if WebSocket is not connected
    const interval = setInterval(() => {
      if (wsClient.getStatus() !== 'connected') {
        console.log('WebSocket not connected, polling for traces');
        loadTraces();
      }
    }, 10000); // Poll every 10 seconds if WebSocket is not connected

    return () => {
      // Clean up listeners when component unmounts
      wsClient.offStatusChange(setConnectionStatus);
      wsClient.off('newTrace', handleNewTrace);
      wsClient.off('traces', handleTracesUpdate);
      clearInterval(interval);
    };
  }, [loadTraces, handleNewTrace, handleTracesUpdate]);

  const formatDate = (date: Date | number) => {
    if (date instanceof Date) {
      return date.toLocaleTimeString();
    }
    return new Date(date).toLocaleTimeString();
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    if (status < 300) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (status < 400) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (status < 500) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const TraceDetails = ({ trace }: { trace: TraceData }) => (
    <div className="h-full flex flex-col">
      <h4 className="text-sm font-medium mb-2">Trace Details</h4>
      <div className="flex-1 overflow-auto">
        <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs h-full overflow-auto whitespace-pre-wrap break-words">
          {JSON.stringify(trace, null, 2)}
        </pre>
      </div>
      {trace.bodyTruncated && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Note: Request body was truncated due to size limits.
        </div>
      )}
      {trace.responseTruncated && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Note: Response body was truncated due to size limits.
        </div>
      )}
    </div>
  );

  if (loading && traces.length === 0) {
    return (
      <Card title="Request Traces">
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-5 w-5 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading traces...
        </div>
      </Card>
    );
  }

  return (
    <Card title="Request Traces">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Recent Requests</h3>
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-gray-500">{connectionStatus}</span>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => loadTraces()}
            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Refresh
          </button>
          <button
            onClick={handleClearTraces}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear All
          </button>
        </div>
      </div>

      {pagination.total > 0 && (
        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Showing {traces.length} of {pagination.total} traces (page {pagination.page} of {pagination.pages})
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-300px)]">
        {/* Left pane: Traces list */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {traces.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              No traces recorded yet.
            </div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th scope="col" className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Method
                    </th>
                    <th scope="col" className="w-[40%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Path
                    </th>
                    <th scope="col" className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th scope="col" className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {convertedTraces.map((trace, index) => (
                    <tr
                      key={trace.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${selectedTrace === trace.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      onClick={() => setSelectedTrace(selectedTrace === trace.id ? null : trace.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium overflow-hidden">
                        <span className="font-mono">{trace.method}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 overflow-hidden">
                        <span className="font-mono truncate block overflow-hidden text-ellipsis" title={trace.path}>{trace.path}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm overflow-hidden">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(trace.status)}`}>
                          {trace.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 overflow-hidden">
                        {formatDate(traces[index].startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 overflow-hidden">
                        {trace.duration ? `${trace.duration.toFixed(2)} ms` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="flex justify-center mt-4 space-x-2 py-2 bg-white dark:bg-gray-900 border-t">
              <button
                onClick={() => loadTraces(1)}
                disabled={pagination.page === 1}
                className={`px-3 py-1 text-sm rounded ${pagination.page === 1 ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                First
              </button>
              <button
                onClick={() => loadTraces(pagination.page - 1)}
                disabled={pagination.page === 1}
                className={`px-3 py-1 text-sm rounded ${pagination.page === 1 ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => loadTraces(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className={`px-3 py-1 text-sm rounded ${pagination.page === pagination.pages ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                Next
              </button>
              <button
                onClick={() => loadTraces(pagination.pages)}
                disabled={pagination.page === pagination.pages}
                className={`px-3 py-1 text-sm rounded ${pagination.page === pagination.pages ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              >
                Last
              </button>
            </div>
          )}
        </div>

        {/* Right pane: Trace details */}
        <div className={`md:w-1/2 flex-shrink-0 transition-all duration-200 ${selectedTrace ? 'opacity-100' : 'opacity-0 md:block hidden'}`}>
          {selectedTrace && (
            <div className="h-full border rounded-lg bg-gray-50 dark:bg-gray-800 p-4 overflow-hidden">
              <TraceDetails
                trace={convertedTraces.find(t => t.id === selectedTrace)!}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default TracesList;
