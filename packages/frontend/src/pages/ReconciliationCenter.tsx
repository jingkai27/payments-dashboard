import { useState } from 'react';
import {
  useReconciliationReports,
  useReconciliationReport,
  useGenerateMockSettlement,
  useReconcile,
  useResolveDiscrepancy,
} from '../hooks/useReconciliation';
import { Card, StatusBadge } from '../components/ui';
import type { ReconciliationStatus, Discrepancy, SettlementRecord } from '../types';

function getReconStatusBadge(status: ReconciliationStatus) {
  const map: Record<ReconciliationStatus, 'success' | 'warning' | 'error' | 'info' | 'pending'> = {
    COMPLETED: 'success',
    PENDING: 'pending',
    IN_PROGRESS: 'info',
    FAILED: 'error',
    REQUIRES_REVIEW: 'warning',
  };
  return map[status] ?? 'pending';
}

const DISCREPANCY_COLORS: Record<string, string> = {
  MISSING_IN_DB: 'bg-red-50 border-red-200',
  MISSING_IN_PROVIDER: 'bg-orange-50 border-orange-200',
  AMOUNT_MISMATCH: 'bg-yellow-50 border-yellow-200',
  STATUS_MISMATCH: 'bg-blue-50 border-blue-200',
};

export default function ReconciliationCenter() {
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [mockForm, setMockForm] = useState({
    merchantId: '',
    providerId: '',
    fromDate: '',
    toDate: '',
    format: 'json' as 'json' | 'csv',
    introduceDiscrepancies: true,
  });
  const [settlementData, setSettlementData] = useState<SettlementRecord[] | null>(null);
  const [fileUploadData, setFileUploadData] = useState<SettlementRecord[] | null>(null);

  const { data: reportsData, isLoading: reportsLoading } = useReconciliationReports({ limit: 20 });
  const { data: selectedReport } = useReconciliationReport(selectedReportId);
  const generateMock = useGenerateMockSettlement();
  const reconcile = useReconcile();
  const resolveDisc = useResolveDiscrepancy(selectedReportId);

  const reports = reportsData?.data ?? [];

  const handleGenerateMock = () => {
    if (!mockForm.merchantId || !mockForm.providerId || !mockForm.fromDate || !mockForm.toDate) return;
    generateMock.mutate(
      {
        merchantId: mockForm.merchantId,
        providerId: mockForm.providerId,
        fromDate: new Date(mockForm.fromDate).toISOString(),
        toDate: new Date(mockForm.toDate).toISOString(),
        format: mockForm.format,
        introduceDiscrepancies: mockForm.introduceDiscrepancies,
      },
      {
        onSuccess: (data) => {
          setSettlementData(data ?? []);
        },
      }
    );
  };

  const handleReconcile = () => {
    const data = fileUploadData ?? settlementData;
    if (!data || !mockForm.merchantId || !mockForm.providerId) return;
    reconcile.mutate({
      merchantId: mockForm.merchantId,
      providerId: mockForm.providerId,
      fromDate: new Date(mockForm.fromDate).toISOString(),
      toDate: new Date(mockForm.toDate).toISOString(),
      settlementData: data,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          setFileUploadData(Array.isArray(parsed) ? parsed : parsed.data ?? []);
        } else if (file.name.endsWith('.csv')) {
          const lines = text.trim().split('\n');
          const headers = lines[0].split(',');
          const records: SettlementRecord[] = lines.slice(1).map((line) => {
            const values = line.split(',');
            const record: Record<string, string> = {};
            headers.forEach((h, i) => { record[h.trim()] = values[i]?.trim() ?? ''; });
            return {
              transactionId: record.transactionId ?? '',
              amount: parseInt(record.amount ?? '0', 10),
              currency: record.currency ?? 'USD',
              status: record.status ?? '',
              providerRef: record.providerRef || undefined,
              settledAt: record.settledAt || undefined,
            };
          });
          setFileUploadData(records);
        }
      } catch {
        alert('Failed to parse file');
      }
    };
    reader.readAsText(file);
  };

  const handleResolve = (discrepancy: Discrepancy, resolution: 'force_match' | 'refund' | 'ignore') => {
    resolveDisc.mutate({
      discrepancyId: discrepancy.id,
      resolution,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reconciliation Center</h2>
        <p className="mt-1 text-sm text-gray-500">
          Compare provider settlements with local records and resolve discrepancies
        </p>
      </div>

      {/* Mock Settlement Generator */}
      <Card title="Mock Settlement Generator" subtitle="Generate test settlement data from existing transactions">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID</label>
            <input
              type="text"
              value={mockForm.merchantId}
              onChange={(e) => setMockForm({ ...mockForm, merchantId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="UUID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider ID</label>
            <input
              type="text"
              value={mockForm.providerId}
              onChange={(e) => setMockForm({ ...mockForm, providerId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="UUID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
            <select
              value={mockForm.format}
              onChange={(e) => setMockForm({ ...mockForm, format: e.target.value as 'json' | 'csv' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={mockForm.fromDate}
              onChange={(e) => setMockForm({ ...mockForm, fromDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={mockForm.toDate}
              onChange={(e) => setMockForm({ ...mockForm, toDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mockForm.introduceDiscrepancies}
                onChange={(e) => setMockForm({ ...mockForm, introduceDiscrepancies: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              Introduce Discrepancies
            </label>
          </div>
        </div>
        <button
          onClick={handleGenerateMock}
          disabled={generateMock.isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {generateMock.isPending ? 'Generating...' : 'Generate Mock Settlement'}
        </button>
        {settlementData && (
          <p className="mt-2 text-sm text-green-600">
            Generated {settlementData.length} settlement records
          </p>
        )}
      </Card>

      {/* Upload & Reconcile */}
      <Card title="Reconcile" subtitle="Upload provider settlement file or use generated data">
        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Settlement File (CSV/JSON)</label>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {fileUploadData && (
            <p className="text-sm text-green-600 self-end">Loaded {fileUploadData.length} records from file</p>
          )}
        </div>
        <button
          onClick={handleReconcile}
          disabled={reconcile.isPending || (!settlementData && !fileUploadData)}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {reconcile.isPending ? 'Reconciling...' : 'Run Reconciliation'}
        </button>
        {reconcile.data && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
            Reconciliation complete: {reconcile.data.matchedTransactions} matched,{' '}
            {reconcile.data.unmatchedTransactions} discrepancies found.
            <button
              onClick={() => setSelectedReportId(reconcile.data!.id)}
              className="ml-2 text-blue-600 underline"
            >
              View Report
            </button>
          </div>
        )}
      </Card>

      {/* Reports List */}
      <Card title="Reconciliation Reports" subtitle="Previous reconciliation results">
        {reportsLoading ? (
          <p className="text-gray-400 text-center py-8">Loading...</p>
        ) : reports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matched</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discrepancies</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{r.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(r.periodStart).toLocaleDateString()} - {new Date(r.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={getReconStatusBadge(r.status as ReconciliationStatus)}
                        label={r.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.matchedTransactions}/{r.totalTransactions}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.discrepancyCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedReportId(r.id)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No reconciliation reports yet</p>
            <p className="text-sm">Generate a mock settlement and run reconciliation to get started</p>
          </div>
        )}
      </Card>

      {/* Discrepancy Detail Panel */}
      {selectedReportId && selectedReport && (
        <Card
          title={`Report ${selectedReport.id.slice(0, 8)}...`}
          subtitle={`${selectedReport.matchedTransactions} matched, ${selectedReport.unmatchedTransactions} discrepancies`}
        >
          <div className="flex items-center gap-4 mb-4">
            <StatusBadge
              status={getReconStatusBadge(selectedReport.status as ReconciliationStatus)}
              label={selectedReport.status}
            />
            <span className="text-sm text-gray-500">
              {new Date(selectedReport.periodStart).toLocaleDateString()} -{' '}
              {new Date(selectedReport.periodEnd).toLocaleDateString()}
            </span>
            <button
              onClick={() => setSelectedReportId('')}
              className="ml-auto text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>

          {selectedReport.discrepancies.length > 0 ? (
            <div className="space-y-3">
              {selectedReport.discrepancies.map((disc: Discrepancy) => (
                <div
                  key={disc.id}
                  className={`border rounded-lg p-4 ${DISCREPANCY_COLORS[disc.type] ?? 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-white border">
                          {disc.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-mono text-gray-600">{disc.transactionId.slice(0, 12)}...</span>
                      </div>
                      <p className="text-sm text-gray-700">{disc.description}</p>
                      {disc.providerAmount !== undefined && (
                        <p className="text-xs text-gray-500 mt-1">Provider: {disc.providerAmount} | Local: {disc.localAmount ?? 'N/A'}</p>
                      )}
                      {disc.resolution && (
                        <p className="text-xs text-green-600 mt-1">
                          Resolved: {disc.resolution} {disc.resolvedAt ? `at ${new Date(disc.resolvedAt).toLocaleString()}` : ''}
                        </p>
                      )}
                    </div>
                    {!disc.resolution && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleResolve(disc, 'force_match')}
                          disabled={resolveDisc.isPending}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Force Match
                        </button>
                        <button
                          onClick={() => handleResolve(disc, 'refund')}
                          disabled={resolveDisc.isPending}
                          className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                        >
                          Refund
                        </button>
                        <button
                          onClick={() => handleResolve(disc, 'ignore')}
                          disabled={resolveDisc.isPending}
                          className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                        >
                          Ignore
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No discrepancies - all transactions matched!</p>
          )}
        </Card>
      )}
    </div>
  );
}
