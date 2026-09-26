'use client';

import { useState, useEffect } from 'react';

interface Job {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  lastError?: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface OutboxItem {
  id: string;
  eventType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  endpoint: {
    url: string;
  };
  lastError?: string;
  createdAt: string;
}

interface ReceivedEvent {
  id: string;
  eventType: string;
  verified: boolean;
  timestamp: string;
  createdAt: string;
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [receivedEvents, setReceivedEvents] = useState<ReceivedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jobsRes, endpointsRes, outboxRes, eventsRes] = await Promise.all([
        fetch('/api/jobs?limit=10'),
        fetch('/api/webhooks/endpoints'),
        fetch('/api/webhooks/outbox?limit=10'),
        fetch('/api/demo/receiver'),
      ]);

      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (endpointsRes.ok) setEndpoints(await endpointsRes.json());
      if (outboxRes.ok) setOutboxItems(await outboxRes.json());
      if (eventsRes.ok) setReceivedEvents(await eventsRes.json());
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const enqueueTestJob = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'test',
          payload: { message: 'Test job from UI', timestamp: new Date().toISOString() },
        }),
      });

      if (response.ok) {
        showMessage('success', 'Job enqueued successfully');
        await loadData();
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      showMessage('error', `Failed to enqueue job: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const registerDemoEndpoint = async () => {
    setLoading(true);
    try {
      const baseUrl = window.location.origin;
      const response = await fetch('/api/webhooks/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${baseUrl}/api/demo/receiver`,
          description: 'Demo receiver endpoint',
        }),
      });

      if (response.ok) {
        showMessage('success', 'Endpoint registered successfully');
        await loadData();
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      showMessage('error', `Failed to register endpoint: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const enqueueWebhookEvent = async () => {
    if (endpoints.length === 0) {
      showMessage('error', 'Please register an endpoint first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/webhooks/outbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: endpoints[0].id,
          eventType: 'user.created',
          payload: {
            userId: 'user_' + Math.random().toString(36).substr(2, 9),
            email: 'test@example.com',
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (response.ok) {
        showMessage('success', 'Webhook event enqueued');
        await loadData();
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      showMessage('error', `Failed to enqueue webhook: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const runWorker = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/worker/tick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET || 'dev-secret',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        showMessage(
          'success',
          `Worker completed: ${result.jobsCompleted} jobs, ${result.webhooksDelivered} webhooks`
        );
        await loadData();
      } else {
        throw new Error(result.error || 'Worker failed');
      }
    } catch (error) {
      showMessage('error', `Worker error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Job Queue + Webhook Outbox Kit
          </h1>
          <p className="text-gray-600">
            Postgres-backed job queue with signed webhook outbox, retries, and dead-letter
          </p>
        </header>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Demo Actions</h2>
            <div className="space-y-3">
              <button
                onClick={enqueueTestJob}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                1. Enqueue Test Job
              </button>
              <button
                onClick={registerDemoEndpoint}
                disabled={loading}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                2. Register Demo Endpoint
              </button>
              <button
                onClick={enqueueWebhookEvent}
                disabled={loading || endpoints.length === 0}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                3. Enqueue Webhook Event
              </button>
              <button
                onClick={runWorker}
                disabled={loading}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                4. Run Worker Now
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Refresh Data
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Total Jobs</span>
                <span className="font-semibold">{jobs.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Pending Jobs</span>
                <span className="font-semibold text-yellow-600">
                  {jobs.filter(j => j.status === 'PENDING').length}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Completed Jobs</span>
                <span className="font-semibold text-green-600">
                  {jobs.filter(j => j.status === 'COMPLETED').length}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Webhook Endpoints</span>
                <span className="font-semibold">{endpoints.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Outbox Items</span>
                <span className="font-semibold">{outboxItems.length}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Received Events</span>
                <span className="font-semibold text-blue-600">{receivedEvents.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Jobs</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Type</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.slice(0, 5).map(job => (
                    <tr key={job.id} className="border-b last:border-b-0">
                      <td className="py-2 px-2 text-sm">{job.type}</td>
                      <td className="py-2 px-2">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded ${
                            job.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-800'
                              : job.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : job.status === 'PROCESSING'
                              ? 'bg-blue-100 text-blue-800'
                              : job.status === 'FAILED'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-sm">
                        {job.attempts}/{job.maxAttempts}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-gray-500 text-sm">
                        No jobs yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Webhook Outbox</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Event</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left py-2 px-2 text-sm font-medium text-gray-600">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {outboxItems.slice(0, 5).map(item => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="py-2 px-2 text-sm">{item.eventType}</td>
                      <td className="py-2 px-2">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded ${
                            item.status === 'DELIVERED'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : item.status === 'DELIVERING'
                              ? 'bg-blue-100 text-blue-800'
                              : item.status === 'FAILED'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-sm">
                        {item.attempts}/{item.maxAttempts}
                      </td>
                    </tr>
                  ))}
                  {outboxItems.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-gray-500 text-sm">
                        No outbox items yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Webhook Endpoints</h2>
            <div className="space-y-3">
              {endpoints.map(endpoint => (
                <div key={endpoint.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {endpoint.description || 'Unnamed Endpoint'}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        endpoint.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {endpoint.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 break-all">{endpoint.url}</div>
                </div>
              ))}
              {endpoints.length === 0 && (
                <div className="py-4 text-center text-gray-500 text-sm">
                  No endpoints registered
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Received Events</h2>
            <div className="space-y-3">
              {receivedEvents.map(event => (
                <div key={event.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{event.eventType}</span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        event.verified
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {event.verified ? 'Verified' : 'Invalid Signature'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">{event.timestamp}</div>
                </div>
              ))}
              {receivedEvents.length === 0 && (
                <div className="py-4 text-center text-gray-500 text-sm">
                  No events received yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
