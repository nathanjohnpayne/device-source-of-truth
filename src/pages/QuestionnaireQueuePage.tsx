import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Plus, Filter, Search } from 'lucide-react';
import { api } from '../lib/api';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type {
  QuestionnaireIntakeJob,
  QuestionnaireIntakeJobStatus,
  QuestionnaireFormat,
} from '../lib/types';
import type { Partner } from '../lib/types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'parsing', label: 'Parsing' },
  { value: 'parse_failed', label: 'Parse Failed' },
  { value: 'awaiting_extraction', label: 'Awaiting Extraction' },
  { value: 'extracting', label: 'Extracting' },
  { value: 'extraction_failed', label: 'Extraction Failed' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'partially_approved', label: 'Partially Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function statusBadgeVariant(status: QuestionnaireIntakeJobStatus): 'info' | 'warning' | 'danger' | 'success' | 'default' {
  switch (status) {
    case 'uploading':
    case 'parsing':
    case 'extracting':
      return 'info';
    case 'awaiting_extraction':
    case 'pending_review':
      return 'warning';
    case 'parse_failed':
    case 'extraction_failed':
      return 'danger';
    case 'approved':
    case 'partially_approved':
      return 'success';
    case 'rejected':
      return 'default';
    default:
      return 'default';
  }
}

function formatStatusLabel(status: QuestionnaireIntakeJobStatus): string {
  return status
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function formatQuestionnaireFormat(format: QuestionnaireFormat): string {
  return format === 'unknown' ? '—' : format.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUploadedAt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function QuestionnaireQueuePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<QuestionnaireIntakeJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);

  const partnerMap = useMemo(
    () => new Map(partners.map((p) => [p.id, p.displayName])),
    [partners],
  );

  useEffect(() => {
    api.partners
      .list({ pageSize: 500 })
      .then((res) => setPartners(res.data))
      .catch(() => setPartners([]));
  }, []);

  const fetchJobs = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (statusFilter) params.status = statusFilter;
    if (search.trim()) params.search = search.trim();

    api.questionnaireIntake
      .list(params)
      .then((res) => {
        setJobs(res.data);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setSearch(searchInput), 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const columns: Column<QuestionnaireIntakeJob>[] = [
    {
      header: 'File name',
      accessor: 'fileName',
      sortable: true,
      render: (row) => (
        <Link
          to={`/admin/questionnaires/${row.id}`}
          className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.fileName}
        </Link>
      ),
    },
    {
      header: 'Submitter',
      accessor: 'submitterPartnerId',
      sortable: true,
      render: (row) => {
        const pid = row.submitterPartnerId;
        const name = pid ? partnerMap.get(pid) : null;
        if (!name) {
          return (
            <span className="text-amber-600 font-medium">Unassigned</span>
          );
        }
        return <span>{name}</span>;
      },
    },
    {
      header: 'Devices',
      accessor: 'deviceCountDetected',
      sortable: true,
      render: (row) => row.deviceCountDetected ?? '—',
    },
    {
      header: 'Format',
      accessor: 'questionnaireFormat',
      sortable: true,
      render: (row) => formatQuestionnaireFormat(row.questionnaireFormat),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => (
        <Badge variant={statusBadgeVariant(row.status)}>
          {formatStatusLabel(row.status)}
        </Badge>
      ),
    },
    {
      header: 'Uploaded',
      accessor: 'uploadedAt',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-gray-600">
          {formatUploadedAt(row.uploadedAt)}
          {row.uploadedByEmail && (
            <span className="block text-xs text-gray-500 truncate max-w-[180px]">
              {row.uploadedByEmail}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-7 w-7 text-gray-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Questionnaire Intake Queue
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {total.toLocaleString()} job{total !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>
        <Link
          to="/admin/questionnaires/upload"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Upload New
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by file name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && page === 1 ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns}
          data={jobs}
          loading={loading && page > 1}
          onRowClick={(row) => navigate(`/admin/questionnaires/${row.id}`)}
          emptyTitle="No questionnaire jobs"
          emptyDescription="Upload a questionnaire file to get started."
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}
