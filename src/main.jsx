import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowsLeftRight,
  CalendarBlank,
  Camera,
  CaretDown,
  CaretRight,
  ChartBar,
  CheckCircle,
  ClipboardText,
  Copy,
  DotsThree,
  DownloadSimple,
  GearSix,
  Image,
  ListChecks,
  PencilSimple,
  Plus,
  Receipt,
  ShareNetwork,
  Sparkle,
  Tag,
  Trash,
  UsersThree,
} from '@phosphor-icons/react';
import { getBillMissingFields } from './domain/billValidation';
import { createBottomNavItems } from './domain/bottomNav';
import { createProjectCode, normalizeProjectCode } from './domain/codes';
import { parseExpenseText } from './domain/aiParser';
import { formatMoney, fromMinorUnits, toMinorUnits } from './domain/money';
import { findMemberByDisplayName, normalizeMemberDisplayName } from './domain/members';
import { inferPayerMemberId, inferParticipantMemberIds } from './domain/memberInference';
import { buildSettlementSnapshot, createCurrentPeriodLabel, createNextPeriodLabel } from './domain/periods';
import { buildProjectInviteText } from './domain/projectInvite';
import { forgetProjectListItem, rememberProjectListItem } from './domain/projectList';
import { buildSettlementShareText, formatTransferInstruction, summarizeTransfers } from './domain/settlementShare';
import { filterExpenses } from './domain/expenseFilters';
import { formatExpenseShareText } from './domain/expenseShare';
import {
  buildExpenseCsv,
  buildSettlementHistoryCsv,
  buildSettlementSnapshotCsv,
  createExpenseExportFilename,
  createSettlementHistoryExportFilename,
  createSettlementSnapshotExportFilename,
} from './domain/expenseExport';
import { createAiDraft, discardAiDraft } from './services/aiDraftService';
import { createExpense, deleteExpense, fetchProjectDetail, updateExpense } from './services/expenseService';
import { resolveExchangeRateWithFallback } from './services/exchangeRateService';
import { hasBackendConfig, supabase } from './services/apiClient';
import {
  createProject,
  deleteProjectMember,
  joinProject,
  updateProjectMember,
  updateProjectSettings,
} from './services/projectService';
import { buildCurrentSettlement, fetchSettlementSnapshots, settleActivePeriod } from './services/settlementService';
import { subscribeProjectRealtime } from './services/realtimeService';
import { summarizeExpensesByCategory } from './domain/splitting';
import './styles.css';

const fallbackProject = {
  id: 'local-project',
  name: '杭州周末游',
  code: 'A7K2',
  default_currency: 'CNY',
  project_type: 'trip',
  budget_amount_minor: 300000,
  active_period_id: 'local-period',
};

const fallbackPeriod = {
  id: 'local-period',
  project_id: 'local-project',
  label: createCurrentPeriodLabel(),
  status: 'active',
  started_at: new Date().toISOString(),
};

const fallbackMembers = [
  { id: 'm1', display_name: '小陈', initials: '陈', color: '#d6e0f3' },
  { id: 'm2', display_name: '张三', initials: '张', color: '#e1e3e4' },
  { id: 'm3', display_name: 'Ivan', initials: 'I', color: '#22c55e' },
];

const fallbackExpenses = [
  {
    id: 'e1',
    description: '晚餐',
    converted_amount_minor: 40000,
    project_currency: 'CNY',
    payer_member_id: 'm1',
    participant_member_ids: ['m1', 'm2', 'm3'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'e2',
    description: '打车',
    converted_amount_minor: 8650,
    project_currency: 'CNY',
    payer_member_id: 'm2',
    participant_member_ids: ['m1', 'm2'],
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'e3',
    description: '民宿房费',
    converted_amount_minor: 120000,
    project_currency: 'CNY',
    payer_member_id: 'm3',
    participant_member_ids: ['m1', 'm2', 'm3'],
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

const LOCAL_PROJECTS_KEY = 'trip-splitter:local-projects';
const LOCAL_SESSION_KEY = 'trip-splitter:current-session';
const RECENT_PROJECTS_KEY = 'trip-splitter:recent-projects';
const INSTALL_PROMPT_DISMISSED_KEY = 'trip-splitter:install-prompt-dismissed';

const currencies = [
  { code: 'CNY', label: 'CNY - 人民币 (¥)' },
  { code: 'USD', label: 'USD - 美元 ($)' },
  { code: 'JPY', label: 'JPY - 日元 (¥)' },
  { code: 'EUR', label: 'EUR - 欧元 (€)' },
  { code: 'HKD', label: 'HKD - 港币 ($)' },
  { code: 'GBP', label: 'GBP - 英镑 (£)' },
  { code: 'KRW', label: 'KRW - 韩元 (₩)' },
  { code: 'AMD', label: 'AMD - 亚美尼亚德拉姆 (֏)' },
];

const expenseCategories = ['餐饮', '交通', '住宿', '购物', '门票', '日用品', '房租', '水电', '其他'];

const fallbackRates = {
  CNY: { USD: 0.14, EUR: 0.13, JPY: 21.8, HKD: 1.08, GBP: 0.11, KRW: 190, AMD: 50.8 },
  USD: { CNY: 7.25, EUR: 0.93, JPY: 157.4, HKD: 7.82, GBP: 0.8, KRW: 1375, AMD: 368.2 },
  EUR: { CNY: 7.8, USD: 1.08, JPY: 169.2, HKD: 8.42, GBP: 0.86, KRW: 1482, AMD: 397.2 },
  JPY: { CNY: 0.046, USD: 0.0064, EUR: 0.0059, HKD: 0.05, GBP: 0.005, KRW: 8.72, AMD: 2.34 },
  HKD: { CNY: 0.93, USD: 0.128, EUR: 0.119, JPY: 20.1, GBP: 0.1, KRW: 176, AMD: 47.1 },
  GBP: { CNY: 9.2, USD: 1.25, EUR: 1.16, JPY: 199, HKD: 9.78, KRW: 1718, AMD: 460.3 },
  KRW: { CNY: 0.0053, USD: 0.00073, EUR: 0.00067, JPY: 0.115, HKD: 0.0057, GBP: 0.00058, AMD: 0.268 },
  AMD: { CNY: 0.0197, USD: 0.0027, EUR: 0.0025, JPY: 0.427, HKD: 0.0212, GBP: 0.0022, KRW: 3.73 },
};

function buildLocalDraft(sourceType, text = '') {
  if (sourceType === 'text') {
    return parseExpenseText(text);
  }

  return {
    amount: 0,
    currency: 'CNY',
    description: '',
    category: '其他',
    notes: '',
    confidence: 0,
    payerName: '',
    participantNames: [],
  };
}

async function resolveExchangeRate({ fromCurrency, toCurrency }) {
  if (!hasBackendConfig) {
    return resolveExchangeRateWithFallback({
      fromCurrency,
      toCurrency,
      fallbackRates,
      fetchRate: async () => {
        throw new Error('Backend exchange-rate provider is not configured');
      },
    });
  }

  return resolveExchangeRateWithFallback({ fromCurrency, toCurrency, fallbackRates });
}

function memberName(member) {
  return member?.display_name ?? '未知成员';
}

function createLocalMember(displayName) {
  return {
    id: `local-member-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    display_name: displayName,
    initials: displayName.slice(0, 1).toUpperCase(),
    color: '#e1e3e4',
  };
}

function readLocalProjects() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_PROJECTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeLocalProjects(projects) {
  try {
    window.localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // Local persistence is a dev/offline convenience; core in-memory flow should keep working.
  }
}

function saveLocalProjectState({ project, activePeriod, members, expenses, settlementHistory }) {
  if (!project?.code) return;
  const projects = readLocalProjects();
  projects[normalizeProjectCode(project.code)] = {
    project,
    activePeriod,
    members,
    expenses,
    settlementHistory,
  };
  writeLocalProjects(projects);
}

function loadLocalProjectState(code) {
  return readLocalProjects()[normalizeProjectCode(code)] ?? null;
}

function readProjectSession() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function writeProjectSession(session) {
  try {
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session restore is a convenience; users can still re-enter a project code.
  }
}

function clearProjectSession() {
  try {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    // Ignore storage failures; manual join/create still works.
  }
}

function createProjectInviteUrl(code) {
  if (!code || typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('code', normalizeProjectCode(code));
  return url.toString();
}

function readInviteCodeFromUrl() {
  if (typeof window === 'undefined') return '';
  return normalizeProjectCode(new URLSearchParams(window.location.search).get('code'));
}

function clearInviteCodeFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code')) return;
  url.searchParams.delete('code');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function readRecentProjects() {
  try {
    const items = JSON.parse(window.localStorage.getItem(RECENT_PROJECTS_KEY) ?? '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeRecentProjects(projects) {
  try {
    window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // Project list is a local convenience; project codes still work without storage.
  }
}

function rememberRecentProject({ project, username, mode }) {
  const nextProjects = rememberProjectListItem(readRecentProjects(), { project, username, mode });
  writeRecentProjects(nextProjects);
  return nextProjects;
}

function forgetRecentProject(projectId) {
  if (!projectId) return readRecentProjects();
  const nextProjects = forgetProjectListItem(readRecentProjects(), projectId);
  writeRecentProjects(nextProjects);
  return nextProjects;
}

function sourceTypeLabel(sourceType) {
  if (sourceType === 'manual') return '手动录入';
  if (sourceType === 'photo') return '收据照片';
  if (sourceType === 'screenshot') return '支付截图';
  if (sourceType === 'text') return '粘贴文字';
  return 'AI 草稿';
}

function originalAmountLabel(expense, projectCurrency) {
  if (!expense.original_currency || expense.original_currency === projectCurrency || expense.original_amount_minor == null) {
    return '';
  }
  const originalAmount = formatMoney(fromMinorUnits(expense.original_amount_minor), expense.original_currency);
  return `原 ${originalAmount}`;
}

function expenseTraceLabel(expense, projectCurrency) {
  const parts = [originalAmountLabel(expense, projectCurrency)].filter(Boolean);
  if (expense.exchange_rate_provider) {
    parts.push(`汇率 ${expense.exchange_rate_provider}`);
  }
  if (expense.exchange_rate_timestamp) {
    parts.push(new Date(expense.exchange_rate_timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }));
  }
  return parts.join(' · ');
}

function toDateTimeInputValue(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeInputValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function createDraftFromExpense(expense) {
  return {
    mode: 'edit',
    expenseId: expense.id,
    amount: fromMinorUnits(expense.original_amount_minor ?? expense.converted_amount_minor ?? 0),
    currency: expense.original_currency ?? expense.project_currency ?? 'CNY',
    description: expense.description ?? '',
    category: expense.category ?? '其他',
    notes: expense.notes ?? '',
    confidence: 1,
    payerMemberId: expense.payer_member_id,
    participantMemberIds: expense.participant_member_ids ?? [],
    exchangeRate: Number(expense.exchange_rate ?? 1),
    exchangeRateProvider: expense.exchange_rate_provider ?? 'identity',
    exchangeRateTimestamp: expense.exchange_rate_timestamp ?? expense.created_at ?? new Date().toISOString(),
    createdAt: expense.created_at ?? new Date().toISOString(),
    sourceType: expense.source_type ?? 'manual',
    sourceName: expense.source_name ?? null,
    aiDraftId: expense.ai_draft_id ?? null,
  };
}

function Avatar({ member, size = 'md' }) {
  const initials = member?.initials ?? memberName(member).slice(0, 1).toUpperCase();
  const color = member?.color ?? '#e1e3e4';

  return (
    <div className={`avatar avatar-${size}`} style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
}

function TopBar({ title, code, onBack }) {
  const [copyNotice, setCopyNotice] = useState('');

  const copyProjectInvite = async () => {
    if (!code) return;
    const inviteText = buildProjectInviteText({
      projectName: title,
      code,
      appUrl: createProjectInviteUrl(code),
    });

    try {
      await navigator.clipboard.writeText(inviteText);
      setCopyNotice('邀请文案已复制');
    } catch {
      window.prompt('复制邀请文案', inviteText);
      setCopyNotice('可手动复制邀请文案');
    }
  };

  return (
    <header className="top-bar">
      <div className="top-left">
        {onBack ? (
          <button className="icon-button" onClick={onBack} aria-label="返回">
            <ArrowLeft size={22} />
          </button>
        ) : null}
        <h1>{title}</h1>
      </div>
      {code ? (
        <div className="code-share">
          <button className="code-pill" type="button" onClick={copyProjectInvite} aria-label="复制项目邀请">
            <span>#{code}</span>
            <Copy size={15} />
          </button>
          {copyNotice ? <span className="code-copy-notice">{copyNotice}</span> : null}
        </div>
      ) : null}
    </header>
  );
}

function EntryScreen({
  initialName = '',
  initialJoinCode = '',
  onCreateProject,
  onJoinProject,
  onOpenRecentProject,
  onForgetRecentProject,
  recentProjects,
  appError,
  isBusy,
}) {
  const [name, setName] = useState(initialName);
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [error, setError] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (initialName && !name) setName(initialName);
  }, [initialName, name]);

  useEffect(() => {
    setJoinCode(initialJoinCode);
  }, [initialJoinCode]);

  const requireName = () => {
    if (!name.trim()) {
      setError('请输入昵称后再继续');
      return false;
    }
    setError('');
    return true;
  };

  const handleJoin = () => {
    if (!requireName()) return;

    if (joinCode.length !== 4) {
      setJoinError('请输入 4 位项目码');
      return;
    }

    setJoinError('');
    onJoinProject(name.trim(), joinCode);
  };

  return (
    <div className="screen entry-screen">
      <TopBar title="我的项目" />
      <main className="entry-content">
        <section className="entry-visual">
          <div className="visual-card">
            <div className="glass-bars">
              <span />
              <span />
              <span />
            </div>
            <div className="visual-people">
              <div />
              <div />
            </div>
          </div>
          <p>管理你加入的所有群组账本</p>
        </section>

        {recentProjects.length ? (
          <section className="recent-projects" aria-label="项目列表">
            <div className="recent-projects-header">
              <h2>项目列表</h2>
              <span>{recentProjects.length} 个</span>
            </div>
            <div className="recent-project-list">
              {recentProjects.map((recentProject) => (
                <div className="recent-project-item" key={`${recentProject.mode}-${recentProject.id}`}>
                  <button
                    className="recent-project-row"
                    type="button"
                    disabled={isBusy}
                    onClick={() => onOpenRecentProject(recentProject)}
                  >
                    <span>
                      <strong>{recentProject.name}</strong>
                      <small>#{recentProject.code} · {recentProject.username}</small>
                    </span>
                    <CaretRight size={20} />
                  </button>
                  <button
                    className="recent-project-remove"
                    type="button"
                    disabled={isBusy}
                    onClick={() => onForgetRecentProject(recentProject.id)}
                    aria-label={`从项目列表移除 ${recentProject.name}`}
                  >
                    <Trash size={17} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="field-card">
          <label htmlFor="username">设置你的昵称</label>
          <div className={`text-field ${error ? 'has-error' : ''}`}>
            <UsersThree size={21} />
            <input
              id="username"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={error || '输入你的昵称（例：小陈）'}
            />
          </div>
          {appError ? <p className="error-text" role="alert">{appError}</p> : null}
        </section>

        <section className="entry-actions">
          <button
            className="primary-button"
            disabled={isBusy}
            onClick={() => {
              if (requireName()) onCreateProject(name.trim());
            }}
          >
            <Plus size={22} weight="fill" />
            {isBusy ? '处理中...' : '创建新项目'}
          </button>

          <div className="divider"><span>或者</span></div>

          <div className="join-row">
            <div className={`text-field ${joinError ? 'has-error' : ''}`}>
              <Tag size={21} />
              <input
                value={joinCode}
                onChange={(event) => {
                  setJoinCode(normalizeProjectCode(event.target.value));
                  setJoinError('');
                }}
                maxLength={4}
                placeholder="4位项目码"
                className="code-input"
              />
            </div>
            <button
              className="secondary-button"
              disabled={isBusy}
              onClick={handleJoin}
            >
              {isBusy ? '处理中...' : joinCode.length === 4 ? '加入邀请' : '加入'}
            </button>
          </div>
          {joinError ? <p className="join-code-error" role="alert">{joinError}</p> : null}
          {joinCode.length === 4 ? (
            <p className="join-code-hint">已填入邀请项目码 #{joinCode}</p>
          ) : null}
        </section>

      </main>
    </div>
  );
}

function CreateProjectScreen({ username, onBack, onCreated, appError, isBusy }) {
  const [projectName, setProjectName] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [projectType, setProjectType] = useState('trip');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [code] = useState(createProjectCode);
  const [error, setError] = useState('');

  return (
    <div className="screen">
      <TopBar title="创建项目" code={code} onBack={onBack} />
      <main className="content create-content">
        <section className="workspace-image">
          <div className="notebook" />
          <div className="pen" />
          <div className="screen-block" />
        </section>

        <section className="form-stack">
          <label className="form-field">
            <span>项目名称</span>
            <input
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
                setError('');
              }}
              placeholder="例如：杭州周末游"
            />
          </label>

          <label className="form-field">
            <span>项目类型</span>
            <select value={projectType} onChange={(event) => setProjectType(event.target.value)}>
              <option value="trip">朋友出游</option>
              <option value="roommate">合租账本</option>
            </select>
          </label>

          <label className="form-field">
            <span>结算币种</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {currencies.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>{projectType === 'trip' ? '出游预算' : '月度预算'}（可选）</span>
            <input
              value={budgetAmount}
              inputMode="decimal"
              onChange={(event) => setBudgetAmount(event.target.value)}
              placeholder={projectType === 'trip' ? '例如：3000' : '例如：5000'}
            />
          </label>

          <div className="info-card">
            <Sparkle size={20} />
            <p>{projectType === 'trip' ? '适合旅行期间持续记账、看预算和最后结算。' : '适合房租、水电、日用品等周期性合租账单。'} 创建后将生成 4 位项目码。</p>
          </div>

          {error ? <p className="error-text" role="alert">{error}</p> : null}
          {appError ? <p className="error-text" role="alert">{appError}</p> : null}
        </section>

        <button
          className="primary-button"
          disabled={isBusy}
          onClick={() => {
            if (!projectName.trim()) {
              setError('请输入项目名称');
              return;
            }
            const normalizedBudget = budgetAmount.trim();
            const parsedBudget = Number(normalizedBudget);
            if (normalizedBudget && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
              setError('请输入有效预算');
              return;
            }
            onCreated({ name: projectName.trim(), currency, code, username, projectType, budgetAmount });
          }}
        >
          {isBusy ? '处理中...' : '立即创建'}
        </button>
      </main>
    </div>
  );
}

function ProjectHome({
  project,
  activePeriod,
  members,
  expenses,
  currentUsername,
  onOpenAi,
  onOpenSettlement,
  onInviteMember,
  onEditMember,
  onOpenSettings,
  onEditExpense,
  onDeleteExpense,
  isBusy,
}) {
  const [expenseQuery, setExpenseQuery] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('全部');
  const [expenseSort, setExpenseSort] = useState('newest');
  const [expenseCopyNotice, setExpenseCopyNotice] = useState('');
  const [memberInviteNotice, setMemberInviteNotice] = useState('');
  const totalMinor = expenses.reduce((sum, item) => sum + item.converted_amount_minor, 0);
  const budgetMinor = project.budget_amount_minor ?? 0;
  const remainingMinor = budgetMinor - totalMinor;
  const budgetProgress = budgetMinor > 0 ? Math.min(100, Math.round((totalMinor / budgetMinor) * 100)) : 0;
  const rawBudgetProgress = budgetMinor > 0 ? Math.round((totalMinor / budgetMinor) * 100) : 0;
  const projectTypeLabel = project.project_type === 'roommate' ? '合租账本' : '朋友出游';
  const budgetLabel = project.project_type === 'roommate' ? '月度预算剩余' : '预算剩余';
  const remainingText = `${remainingMinor < 0 ? '-' : ''}${formatMoney(fromMinorUnits(Math.abs(remainingMinor)), project.default_currency)}`;
  const budgetDetailLabel = budgetMinor > 0
    ? `已用 ${formatMoney(fromMinorUnits(totalMinor), project.default_currency)} / ${formatMoney(fromMinorUnits(budgetMinor), project.default_currency)} · ${rawBudgetProgress}%`
    : '';
  const memberById = new Map(members.map((member) => [member.id, member]));
  const currentMember = findMemberByDisplayName(members, currentUsername);
  const currentMemberId = currentMember?.id;
  const currentBalances = buildCurrentSettlement({ members, expenses }).balances;
  const currentBalance = currentBalances.find((item) => item.member_id === currentMemberId);
  const currentNetMinor = currentBalance?.net_minor ?? 0;
  const currentNetLabel = currentNetMinor === 0
    ? '已平衡'
    : currentNetMinor > 0
      ? `待收 ${formatMoney(fromMinorUnits(currentNetMinor), project.default_currency)}`
      : `应付 ${formatMoney(fromMinorUnits(Math.abs(currentNetMinor)), project.default_currency)}`;
  const currentPaidLabel = formatMoney(fromMinorUnits(currentBalance?.paid_minor ?? 0), project.default_currency);
  const currentOwedLabel = formatMoney(fromMinorUnits(currentBalance?.owed_minor ?? 0), project.default_currency);
  const filteredExpenses = filterExpenses({
    expenses,
    members,
    query: expenseQuery,
    category: expenseCategoryFilter,
    sort: expenseSort,
  });
  const hasExpenseFilters = expenseQuery.trim() || expenseCategoryFilter !== '全部';

  const copyExpenseText = async (expense) => {
    const text = formatExpenseShareText({ expense, project, members });

    try {
      await navigator.clipboard.writeText(text);
      setExpenseCopyNotice(`已复制：${expense.description || '未命名账单'}`);
    } catch {
      window.prompt('复制账单摘要', text);
      setExpenseCopyNotice('已生成账单摘要');
    }
  };

  const copyMemberInvite = async () => {
    await onInviteMember();
    setMemberInviteNotice('邀请已复制，成员需输入邀请码加入');
  };

  return (
    <div className="screen">
      <TopBar title={project.name} code={project.code} />
      <main className="content with-nav">
        <section className="summary-grid">
          <article className="total-card">
            <p>{projectTypeLabel} · 总计支出 ({project.default_currency}) · {activePeriod.label}</p>
            <h2>{formatMoney(fromMinorUnits(totalMinor), project.default_currency)}</h2>
          </article>
          <article className="mini-card">
            <p>{budgetMinor > 0 ? budgetLabel : '项目类型'}</p>
            <strong className={remainingMinor < 0 ? 'negative' : 'positive'}>
              {budgetMinor > 0 ? remainingText : projectTypeLabel}
            </strong>
            {budgetMinor > 0 ? (
              <>
                <small className="budget-detail">{budgetDetailLabel}</small>
                <div className="budget-progress" aria-label={`预算已使用 ${rawBudgetProgress}%`}>
                  <span
                    className={remainingMinor < 0 ? 'over-budget' : ''}
                    style={{ width: `${budgetProgress}%` }}
                  />
                </div>
              </>
            ) : null}
          </article>
          <article className="mini-card">
            <p>我的余额</p>
            <strong className={currentNetMinor < 0 ? 'negative' : 'positive'}>
              {currentNetLabel}
            </strong>
            <small className="balance-detail">已付 {currentPaidLabel} · 应摊 {currentOwedLabel}</small>
          </article>
          <article className="mini-card member-card">
            <div>
              <p>成员</p>
              <strong>{members.length} 人</strong>
            </div>
            <div className="avatar-stack">
              {members.map((member) => (
                <div className="avatar-stack-item" key={member.id}>
                  <Avatar member={member} size="sm" />
                  {member.id === currentMemberId ? <span>我</span> : null}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="section-block">
          <div className="section-header">
            <h3>小组成员</h3>
            <button type="button" onClick={copyMemberInvite}>邀请成员</button>
          </div>
          <div className="member-strip">
            {members.map((member) => (
              <button
                className="member-chip"
                key={member.id}
                type="button"
                onClick={() => onEditMember(member)}
                aria-label={`编辑成员 ${memberName(member)}`}
              >
                <Avatar member={member} />
                <span>
                  {memberName(member)}
                  {member.id === currentMemberId ? <b>我</b> : null}
                </span>
              </button>
            ))}
          </div>
          {memberInviteNotice ? <p className="member-invite-notice">{memberInviteNotice}</p> : null}
        </section>

        <section className="section-block">
          <div className="section-header">
            <h3>最近明细</h3>
            <div className="section-header-actions">
              <button type="button" onClick={onOpenAi}>记一笔</button>
              <button type="button" onClick={onOpenSettlement}>查看结算</button>
            </div>
          </div>
          {expenses.length ? (
            <div className="expense-filter-bar">
              <label className="expense-search-field">
                <span>搜索账单</span>
                <input
                  value={expenseQuery}
                  onChange={(event) => setExpenseQuery(event.target.value)}
                  placeholder="描述、备注、成员"
                />
              </label>
              <label className="expense-category-filter">
                <span>分类</span>
                <select
                  value={expenseCategoryFilter}
                  onChange={(event) => setExpenseCategoryFilter(event.target.value)}
                >
                  <option value="全部">全部</option>
                  {expenseCategories.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="expense-sort-field">
                <span>排序</span>
                <select
                  value={expenseSort}
                  onChange={(event) => setExpenseSort(event.target.value)}
                >
                  <option value="newest">最新</option>
                  <option value="oldest">最早</option>
                  <option value="amount_desc">金额高</option>
                  <option value="amount_asc">金额低</option>
                </select>
              </label>
            </div>
          ) : null}
          <div className="expense-list">
            {expenses.length === 0 ? (
              <div className="expense-empty-card">
                <div className="expense-empty-icon"><Sparkle size={24} weight="fill" /></div>
                <strong>还没有账单</strong>
                <p>拍小票、上传支付截图，或粘贴群聊记录，先生成一笔待确认账单。</p>
                <button type="button" onClick={onOpenAi}>AI 录入第一笔</button>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="expense-empty-card compact">
                <strong>没有匹配的账单</strong>
                <p>换个关键词或切回全部分类再试。</p>
                <button
                  type="button"
                  onClick={() => {
                    setExpenseQuery('');
                    setExpenseCategoryFilter('全部');
                  }}
                >
                  清除筛选
                </button>
              </div>
            ) : filteredExpenses.map((expense) => {
              const traceLabel = expenseTraceLabel(expense, project.default_currency);
              const splitMinor = Math.round(expense.converted_amount_minor / expense.participant_member_ids.length);
              const splitLabel = formatMoney(fromMinorUnits(splitMinor), project.default_currency);
              const participantNames = expense.participant_member_ids
                .map((memberId) => memberName(memberById.get(memberId)))
                .join('、');
              return (
                <article className="expense-row" key={expense.id}>
                  <div className="expense-icon"><Receipt size={22} /></div>
                  <div className="expense-copy">
                    <h4>{expense.description}</h4>
                    <p>
                      {expense.category ?? '其他'} · {memberName(memberById.get(expense.payer_member_id))}支付 · {expense.participant_member_ids.length}人平分 · 每人约 {splitLabel}
                      {expense.source_name ? ` · ${sourceTypeLabel(expense.source_type)} ${expense.source_name}` : ''}
                    </p>
                    {participantNames ? <small className="expense-participants">参与：{participantNames}</small> : null}
                    {expense.notes ? <small className="expense-notes">{expense.notes}</small> : null}
                  </div>
                  <div className="expense-amount">
                    <strong>{formatMoney(fromMinorUnits(expense.converted_amount_minor), project.default_currency)}</strong>
                    {traceLabel ? <small>{traceLabel}</small> : null}
                    <span>{new Date(expense.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="expense-actions">
                    <button
                      className="copy-expense-button"
                      type="button"
                      disabled={isBusy}
                      onClick={() => copyExpenseText(expense)}
                      aria-label={`复制账单 ${expense.description}`}
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      className="edit-expense-button"
                      type="button"
                      disabled={isBusy}
                      onClick={() => onEditExpense(expense)}
                      aria-label={`编辑账单 ${expense.description}`}
                    >
                      <PencilSimple size={18} />
                    </button>
                    <button
                      className="delete-expense-button"
                      type="button"
                      disabled={isBusy}
                      onClick={() => onDeleteExpense(expense)}
                      aria-label={`删除账单 ${expense.description}`}
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          {hasExpenseFilters && filteredExpenses.length ? (
            <p className="expense-filter-summary">已显示 {filteredExpenses.length} / {expenses.length} 笔</p>
          ) : null}
          {expenseCopyNotice ? <p className="expense-copy-notice">{expenseCopyNotice}</p> : null}
        </section>
      </main>
      <button className="ai-fab" onClick={onOpenAi}>
        <Sparkle size={22} weight="fill" />
        AI 记账
      </button>
      <BottomNav active="details" onStats={onOpenSettlement} onSettings={onOpenSettings} />
    </div>
  );
}

function MemberDialog({ member, onClose, onSubmit, onDelete, appError, isBusy }) {
  const [displayName, setDisplayName] = useState(member?.display_name ?? '');
  const [error, setError] = useState('');

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="关闭" />
      <form
        className="member-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (!displayName.trim()) {
            setError('请输入成员昵称');
            return;
          }
          onSubmit(displayName.trim(), member);
        }}
      >
        <h2>编辑成员</h2>
        <label className="form-field">
          <span>成员昵称</span>
          <input
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setError('');
            }}
            placeholder="输入新的昵称"
          />
        </label>
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        {appError ? <p className="error-text" role="alert">{appError}</p> : null}
        <button className="primary-button" type="submit" disabled={isBusy}>
          {isBusy ? '保存中...' : '保存成员'}
        </button>
        {member ? (
          <button
            className="danger-button"
            type="button"
            disabled={isBusy}
            onClick={() => onDelete(member)}
          >
            <Trash size={18} />
            删除成员
          </button>
        ) : null}
        <button className="cancel-button" type="button" onClick={onClose}>取消</button>
      </form>
    </div>
  );
}

function AiSheet({ onClose, onConfirm, isBusy }) {
  const [textInput, setTextInput] = useState('');
  const [textMode, setTextMode] = useState(false);
  const [error, setError] = useState('');
  const options = [
    { icon: <Camera size={24} />, title: '拍摄收据', desc: '拍照并识别纸质账单明细', sourceType: 'photo' },
    { icon: <Image size={24} />, title: '上传截图', desc: '微信/支付宝支付详情页截图', sourceType: 'screenshot' },
    { icon: <ClipboardText size={24} />, title: '粘贴文字', desc: '粘贴群聊记录或账单文本', sourceType: 'text' },
    { icon: <ListChecks size={24} />, title: '手动录入', desc: 'AI 不可用时直接填写账单', sourceType: 'manual' },
  ];

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="关闭" />
      <section className="ai-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>选择记账方式</h2>
          <span><Sparkle size={16} weight="fill" />AI 将自动识别金额、币种和描述</span>
        </div>
        <div className="sheet-options">
          {options.map((option) => {
            const content = (
              <>
                <div>{option.icon}</div>
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.desc}</small>
                </span>
                <CaretRight size={20} />
              </>
            );

            if (option.sourceType === 'text') {
              return (
                <button
                  className="sheet-option"
                  key={option.title}
                  disabled={isBusy}
                  onClick={() => {
                    setError('');
                    setTextMode(true);
                  }}
                >
                  {content}
                </button>
              );
            }

            if (option.sourceType === 'manual') {
              return (
                <button
                  className="sheet-option"
                  key={option.title}
                  disabled={isBusy}
                  onClick={() => {
                    setError('');
                    onConfirm({ sourceType: 'manual' });
                  }}
                >
                  {content}
                </button>
              );
            }

            return (
              <label className={`sheet-option ${isBusy ? 'disabled' : ''}`} key={option.title}>
                {content}
                <input
                  className="file-input"
                  type="file"
                  accept="image/*"
                  capture={option.sourceType === 'photo' ? 'environment' : undefined}
                  disabled={isBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setError('');
                    onConfirm({ sourceType: option.sourceType, file });
                  }}
                />
              </label>
            );
          })}
        </div>
        {textMode ? (
          <form
            className="text-draft-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!textInput.trim()) {
                setError('请先粘贴账单文字');
                return;
              }
              onConfirm({ sourceType: 'text', text: textInput.trim() });
            }}
          >
            <label htmlFor="ai-text-input">账单文字</label>
            <textarea
              id="ai-text-input"
              value={textInput}
              onChange={(event) => {
                setTextInput(event.target.value);
                setError('');
              }}
              placeholder="例：Starbucks $40.00 Ivan 已付，大家平分"
            />
            {error ? <p className="error-text" role="alert">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={isBusy}>
              {isBusy ? '识别中...' : '生成草稿'}
            </button>
          </form>
        ) : null}
        <button className="cancel-button" onClick={onClose}>取消</button>
      </section>
    </div>
  );
}

function ConfirmBill({ project, members, draft, onBack, onSave, onResolveRate, appError, isBusy }) {
  const isEditing = draft.mode === 'edit';
  const [amount, setAmount] = useState(String(draft.amount));
  const [currency, setCurrency] = useState(draft.currency);
  const [description, setDescription] = useState(draft.description);
  const [category, setCategory] = useState(draft.category ?? '其他');
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [createdAtInput, setCreatedAtInput] = useState(toDateTimeInputValue(draft.createdAt));
  const [exchangeRate, setExchangeRate] = useState(draft.exchangeRate);
  const [manualRateInput, setManualRateInput] = useState(String(draft.exchangeRate ?? 1));
  const [rateEditing, setRateEditing] = useState(false);
  const [exchangeRateProvider, setExchangeRateProvider] = useState(draft.exchangeRateProvider);
  const [exchangeRateTimestamp, setExchangeRateTimestamp] = useState(draft.exchangeRateTimestamp);
  const [localError, setLocalError] = useState('');
  const [manualOpen, setManualOpen] = useState((draft.confidence ?? 0) === 0);
  const [payerMemberId, setPayerMemberId] = useState(draft.payerMemberId ?? members[0]?.id);
  const [participantIds, setParticipantIds] = useState(
    draft.participantMemberIds?.length ? draft.participantMemberIds : members.map((member) => member.id),
  );
  const payer = members.find((member) => member.id === payerMemberId) ?? members[0];
  const numericAmount = Number(amount);
  const numericExchangeRate = Number(exchangeRate);
  const validExchangeRate = Number.isFinite(numericExchangeRate) && numericExchangeRate > 0;
  const converted = validExchangeRate ? numericAmount * numericExchangeRate : NaN;
  const perPersonShare = participantIds.length && Number.isFinite(converted) ? converted / participantIds.length : 0;
  const missingFields = getBillMissingFields({
    amount: numericAmount,
    description,
    payerMemberId: payer?.id,
    participantMemberIds: participantIds,
  });
  const createdAt = fromDateTimeInputValue(createdAtInput);
  const saveMissingFields = [
    ...missingFields,
    ...(validExchangeRate ? [] : ['汇率']),
    ...(createdAt ? [] : ['账单时间']),
  ];
  const canSave = saveMissingFields.length === 0;

  const toggleParticipant = (memberId) => {
    setParticipantIds((current) => {
      if (current.includes(memberId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== memberId);
      }
      return [...current, memberId];
    });
  };

  const refreshRate = async (nextCurrency = currency) => {
    setLocalError('');
    try {
      const rate = await onResolveRate({ fromCurrency: nextCurrency, toCurrency: project.default_currency });
      setExchangeRate(rate.rate);
      setManualRateInput(String(rate.rate));
      setExchangeRateProvider(rate.provider);
      setExchangeRateTimestamp(rate.timestamp);
      setRateEditing(false);
    } catch (error) {
      setLocalError(error.message || '汇率刷新失败');
    }
  };

  const applyManualRate = () => {
    const nextRate = Number(manualRateInput);

    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      setLocalError('请输入大于 0 的汇率');
      return;
    }

    setExchangeRate(nextRate);
    setExchangeRateProvider('manual');
    setExchangeRateTimestamp(new Date().toISOString());
    setLocalError('');
    setManualOpen(true);
    setRateEditing(false);
  };

  return (
    <div className="screen">
      <TopBar title={isEditing ? '编辑账单' : '确认账单'} code={project.code} onBack={onBack} />
      <main className="content confirm-content">
        <section className="amount-card">
          <label>金额</label>
          <h2>{Number.isFinite(numericAmount) ? formatMoney(numericAmount, currency) : `${currency} --`}</h2>
          <p>{currency} · AI 置信度 {Math.round((draft.confidence ?? 0) * 100)}%</p>
        </section>

        <section className="fx-card">
          <div>
            <p>
              <ArrowsLeftRight size={17} />
              汇率 1 {currency} = {validExchangeRate ? numericExchangeRate.toFixed(4) : '--'} {project.default_currency}
            </p>
            <strong>折合 {Number.isFinite(converted) ? formatMoney(converted, project.default_currency) : '--'}</strong>
            <small>{exchangeRateProvider} · {new Date(exchangeRateTimestamp).toLocaleString('zh-CN')}</small>
            {rateEditing ? (
              <div className="fx-edit-row">
                <span>1 {currency} =</span>
                <input
                  aria-label="手动汇率"
                  inputMode="decimal"
                  value={manualRateInput}
                  onChange={(event) => {
                    setManualRateInput(event.target.value);
                    setLocalError('');
                  }}
                />
                <span>{project.default_currency}</span>
              </div>
            ) : null}
          </div>
          <div className="fx-actions">
            {rateEditing ? (
              <button disabled={isBusy} onClick={applyManualRate} type="button">应用</button>
            ) : (
              <button disabled={isBusy} onClick={() => setRateEditing(true)} type="button">手动汇率</button>
            )}
            <button disabled={isBusy} onClick={() => refreshRate()} type="button">刷新汇率</button>
          </div>
        </section>

        <section className="form-stack">
          <section className="source-card">
            <span>{sourceTypeLabel(draft.sourceType)}</span>
            <strong>{draft.sourceName ?? ((draft.confidence ?? 0) === 0 ? '待手动补全草稿' : 'AI 自动生成草稿')}</strong>
          </section>
          <div className="edit-grid">
            <label className="form-field">
              <span>原始金额</span>
              <input
                value={amount}
                inputMode="decimal"
                onChange={(event) => {
                  setAmount(event.target.value);
                  setLocalError('');
                }}
                onFocus={() => setManualOpen(true)}
              />
            </label>
            <label className="form-field">
              <span>币种</span>
              <select
                value={currency}
                onChange={(event) => {
                  const nextCurrency = event.target.value;
                  setCurrency(nextCurrency);
                  refreshRate(nextCurrency);
                }}
              >
                {currencies.map((item) => (
                  <option key={item.code} value={item.code}>{item.code}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="field-group">
            <label>付款人</label>
            <div className="participant-box">
              {members.map((member) => (
                <button
                  className={`participant ${member.id === payerMemberId ? 'active' : ''}`}
                  key={member.id}
                  type="button"
                  onClick={() => setPayerMemberId(member.id)}
                >
                  {memberName(member)}
                  {member.id === payerMemberId ? <CheckCircle size={15} weight="fill" /> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <label>参与人（{participantIds.length}人）</label>
            <div className="participant-box">
              {members.map((member) => (
                <button
                  className={`participant ${participantIds.includes(member.id) ? 'active' : ''}`}
                  key={member.id}
                  type="button"
                  onClick={() => toggleParticipant(member.id)}
                >
                  {memberName(member)}
                  {participantIds.includes(member.id) ? <CheckCircle size={15} weight="fill" /> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="split-preview">
            <span>等额分摊</span>
            <strong>
              {participantIds.length} 人 · 每人约 {formatMoney(perPersonShare, project.default_currency)}
            </strong>
          </div>
          <label className="form-field">
            <span>描述</span>
            <input
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setLocalError('');
              }}
              onFocus={() => setManualOpen(true)}
            />
          </label>
          <div className="edit-grid">
            <label className="form-field">
              <span>分类</span>
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setLocalError('');
                }}
              >
                {expenseCategories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>备注</span>
              <input
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setLocalError('');
                }}
                onFocus={() => setManualOpen(true)}
                placeholder="可选"
              />
            </label>
          </div>
          <label className="form-field">
            <span>账单时间</span>
            <input
              type="datetime-local"
              value={createdAtInput}
              onChange={(event) => {
                setCreatedAtInput(event.target.value);
                setLocalError('');
              }}
              onFocus={() => setManualOpen(true)}
            />
          </label>
          {manualOpen ? (
            <p className="manual-note">
              {(draft.confidence ?? 0) === 0
                ? '当前草稿需要手动补全金额、币种、付款人、参与人和描述。'
                : '可在保存前修正 AI 识别的金额、币种、付款人、参与人和描述。'}
            </p>
          ) : null}
          {saveMissingFields.length ? (
            <p className="save-hint">还需补全：{saveMissingFields.join('、')}</p>
          ) : null}
          {localError ? <p className="error-text" role="alert">{localError}</p> : null}
          {appError ? <p className="error-text" role="alert">{appError}</p> : null}
        </section>
      </main>
      <div className="bottom-actions">
        <button
          className="primary-button"
          disabled={isBusy || !canSave}
          onClick={() => onSave({
            amount: numericAmount,
            currency,
            convertedAmount: converted,
            exchangeRate,
            exchangeRateProvider,
            exchangeRateTimestamp,
            description: description.trim(),
            category,
            notes: notes.trim(),
            payerMemberId: payer.id,
            participantMemberIds: participantIds,
            sourceType: draft.sourceType,
            sourceName: draft.sourceName,
            aiDraftId: draft.aiDraftId,
            mode: draft.mode,
            expenseId: draft.expenseId,
            createdAt,
          })}
        >
          {isBusy ? '保存中...' : saveMissingFields.length ? `补全${saveMissingFields[0]}后保存` : isEditing ? '保存修改' : '保存账单'}
        </button>
        <button className="text-button" onClick={() => setManualOpen((current) => !current)}>
          {manualOpen ? '收起修改提示' : '手动修改'}
        </button>
      </div>
    </div>
  );
}

function PickerRow({ label, value, member }) {
  return (
    <div className="field-group">
      <label>{label}</label>
      <button className="picker-row">
        <span><Avatar member={member} size="sm" />{value}</span>
        <CaretDown size={18} />
      </button>
    </div>
  );
}

function settlementHistoryMeta(snapshot) {
  const balances = snapshot.member_balance_payload ?? [];
  const transfers = snapshot.transfer_payload ?? [];
  const totalMinor = snapshot.total_minor ?? balances.reduce((sum, balance) => sum + balance.paid_minor, 0);
  return {
    memberCount: balances.length,
    transferCount: transfers.length,
    totalMinor,
    transferSummary: summarizeTransfers(transfers, snapshot.project_currency),
  };
}

function SettlementHistoryDetail({ project, snapshot, onClose }) {
  const [copyNotice, setCopyNotice] = useState('');
  const balances = snapshot.member_balance_payload ?? [];
  const transfers = snapshot.transfer_payload ?? [];
  const meta = settlementHistoryMeta(snapshot);
  const periodLabel = snapshot.period_label ?? '历史周期';

  const copyHistoryText = async () => {
    const text = buildSettlementShareText({
      project,
      period: { label: periodLabel },
      transfers,
      currency: snapshot.project_currency ?? project.default_currency,
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice('历史结算文案已复制');
    } catch {
      window.prompt('复制历史结算文案', text);
      setCopyNotice('已生成历史结算文案');
    }
  };

  const exportHistorySnapshot = () => {
    const csv = buildSettlementSnapshotCsv({ project, snapshot });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = createSettlementSnapshotExportFilename({ project, snapshot });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setCopyNotice('该次历史结算 CSV 已导出');
  };

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="关闭" />
      <section className="history-detail-sheet">
        <div className="sheet-handle" />
        <div className="history-detail-header">
          <div>
            <span>{periodLabel}</span>
            <h2>历史结算详情</h2>
          </div>
          <div className="history-detail-actions">
            <button
              className="copy-transfer-button"
              type="button"
              onClick={exportHistorySnapshot}
              aria-label="导出该次历史结算"
            >
              <DownloadSimple size={18} />
            </button>
            <button
              className="copy-transfer-button"
              type="button"
              onClick={copyHistoryText}
              aria-label="复制历史结算文案"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>

        <div className="history-detail-summary">
          <div>
            <span>归档金额</span>
            <strong>{formatMoney(fromMinorUnits(meta.totalMinor), snapshot.project_currency ?? project.default_currency)}</strong>
          </div>
          <div>
            <span>成员 / 转账</span>
            <strong>{meta.memberCount} 人 · {meta.transferCount} 笔</strong>
          </div>
          <div>
            <span>账单数</span>
            <strong>{snapshot.included_expense_ids?.length ?? 0} 笔</strong>
          </div>
        </div>

        <section className="history-detail-section">
          <h3>成员净额</h3>
          {balances.map((balance) => (
            <div className="history-balance-row" key={balance.member_id}>
              <span className="avatar avatar-sm">{balance.display_name?.[0] ?? '?'}</span>
              <strong>{balance.display_name}</strong>
              <div>
                <b className={balance.net_minor >= 0 ? 'positive' : 'negative'}>
                  {balance.net_minor >= 0 ? '+' : '-'}{formatMoney(fromMinorUnits(Math.abs(balance.net_minor)), snapshot.project_currency ?? project.default_currency)}
                </b>
                <small>已付 {formatMoney(fromMinorUnits(balance.paid_minor), snapshot.project_currency ?? project.default_currency)} · 应摊 {formatMoney(fromMinorUnits(balance.owed_minor), snapshot.project_currency ?? project.default_currency)}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="history-detail-section">
          <h3>转账方案</h3>
          {transfers.length ? (
            transfers.map((transfer) => (
              <article className="history-transfer-row" key={`${transfer.from_member_id}-${transfer.to_member_id}-${transfer.amount_minor}`}>
                <span>{transfer.from_name}</span>
                <ArrowsLeftRight size={16} />
                <span>{transfer.to_name}</span>
                <strong>{formatMoney(fromMinorUnits(transfer.amount_minor), snapshot.project_currency ?? project.default_currency)}</strong>
              </article>
            ))
          ) : (
            <p className="history-detail-empty">该周期无需转账。</p>
          )}
        </section>

        {copyNotice ? <p className="settings-notice">{copyNotice}</p> : null}
        <button className="cancel-button" type="button" onClick={onClose}>关闭</button>
      </section>
    </div>
  );
}

function SettlementConfirmDialog({ project, expenses, transfers, onCancel, onConfirm, isBusy }) {
  const totalMinor = expenses.reduce((sum, expense) => sum + expense.converted_amount_minor, 0);

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onCancel} aria-label="取消结算" />
      <section className="settlement-confirm-dialog">
        <div className="settlement-confirm-icon">
          <CheckCircle size={26} weight="fill" />
        </div>
        <h2>确认归档本周期？</h2>
        <p>归档后当前账单会进入历史结算，并自动开启下一周期。</p>
        <div className="settlement-confirm-grid">
          <div>
            <span>账单数</span>
            <strong>{expenses.length} 笔</strong>
          </div>
          <div>
            <span>总金额</span>
            <strong>{formatMoney(fromMinorUnits(totalMinor), project.default_currency)}</strong>
          </div>
          <div>
            <span>转账方案</span>
            <strong>{transfers.length} 笔</strong>
          </div>
        </div>
        <button className="primary-button" type="button" disabled={isBusy} onClick={onConfirm}>
          {isBusy ? '归档中...' : '确认归档'}
        </button>
        <button className="cancel-button" type="button" disabled={isBusy} onClick={onCancel}>再检查一下</button>
      </section>
    </div>
  );
}

function DeleteExpenseConfirmDialog({ project, expense, members, onCancel, onConfirm, isBusy }) {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const payer = memberById.get(expense.payer_member_id);

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onCancel} aria-label="取消删除账单" />
      <section className="delete-confirm-dialog">
        <div className="delete-confirm-icon">
          <Trash size={24} weight="fill" />
        </div>
        <h2>删除这笔账单？</h2>
        <p>删除后本周期统计、成员余额和结算方案都会同步更新。</p>
        <div className="delete-confirm-summary">
          <span>{expense.description || '未命名账单'}</span>
          <strong>{formatMoney(fromMinorUnits(expense.converted_amount_minor), project.default_currency)}</strong>
          <small>
            {memberName(payer)}支付 · {(expense.participant_member_ids ?? []).length}人平分
          </small>
        </div>
        <button className="danger-button" type="button" disabled={isBusy} onClick={() => onConfirm(expense)}>
          <Trash size={18} />
          {isBusy ? '删除中...' : '确认删除'}
        </button>
        <button className="cancel-button" type="button" disabled={isBusy} onClick={onCancel}>取消</button>
      </section>
    </div>
  );
}

function DeleteMemberConfirmDialog({ member, onCancel, onConfirm, isBusy }) {
  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onCancel} aria-label="取消删除成员" />
      <section className="delete-confirm-dialog">
        <div className="delete-confirm-icon">
          <Trash size={24} weight="fill" />
        </div>
        <h2>删除这个成员？</h2>
        <p>仅能删除还没有账单记录的成员，删除后成员列表会同步更新。</p>
        <div className="delete-confirm-summary">
          <span>{memberName(member)}</span>
          <small>该成员当前没有付款或分摊记录</small>
        </div>
        <button className="danger-button" type="button" disabled={isBusy} onClick={() => onConfirm(member)}>
          <Trash size={18} />
          {isBusy ? '删除中...' : '确认删除成员'}
        </button>
        <button className="cancel-button" type="button" disabled={isBusy} onClick={onCancel}>取消</button>
      </section>
    </div>
  );
}

function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (isStandaloneApp() || window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === '1') {
      return undefined;
    }

    const ios = isIosDevice();
    setIsIos(ios);
    if (ios) setVisible(true);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
      window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  return (
    <section className="install-prompt" aria-label="添加到手机桌面">
      <div>
        <strong>添加到手机桌面</strong>
        <p>
          {isIos
            ? '在 iPhone Safari 中点分享按钮，然后选择“添加到主屏幕”。'
            : '把分账助手安装到桌面，下次可以像 App 一样打开。'}
        </p>
      </div>
      <div className="install-prompt-actions">
        {deferredPrompt ? <button type="button" onClick={install}>安装</button> : null}
        <button type="button" onClick={dismiss}>{isIos ? '知道了' : '稍后'}</button>
      </div>
    </section>
  );
}

function SettlementScreen({
  project,
  activePeriod,
  members,
  expenses,
  settlementHistory,
  onBack,
  onOpenSettings,
  onSettled,
  settledNotice,
  isBusy,
  appError,
}) {
  const { balances, transfers } = buildCurrentSettlement({ members, expenses });
  const categorySummary = summarizeExpensesByCategory(expenses);
  const [shareNotice, setShareNotice] = useState('');
  const [selectedHistorySnapshot, setSelectedHistorySnapshot] = useState(null);
  const [settlementConfirmOpen, setSettlementConfirmOpen] = useState(false);

  const copySettlementText = async () => {
    const text = buildSettlementShareText({
      project,
      period: activePeriod,
      transfers,
      currency: project.default_currency,
    });

    try {
      await navigator.clipboard.writeText(text);
      setShareNotice('结算文案已复制，可直接发到微信群');
    } catch {
      window.prompt('复制结算文案', text);
      setShareNotice('已生成结算文案');
    }
  };

  const copyTransferInstruction = async (transfer) => {
    const text = formatTransferInstruction(transfer, project.default_currency);

    try {
      await navigator.clipboard.writeText(text);
      setShareNotice(`已复制：${text}`);
    } catch {
      window.prompt('复制单笔转账', text);
      setShareNotice('已生成单笔转账文案');
    }
  };

  return (
    <div className="screen">
      <TopBar title="结算汇总" code={project.code} onBack={onBack} />
      <main className="content with-nav settlement-content">
        <section className="period-card">
          <div>
            <span>当前周期</span>
            <strong><CalendarBlank size={20} />{activePeriod.label}</strong>
          </div>
          <small>结算后自动进入下一周期</small>
        </section>

        <section className="balance-card">
          <h3>净支出状态</h3>
          {balances.map((item) => (
            <div className="balance-row" key={item.member_id}>
              <span className="avatar avatar-sm">{item.display_name[0]}</span>
              <strong>{item.display_name}</strong>
              <div>
                <b className={item.net_minor >= 0 ? 'positive' : 'negative'}>
                  {item.net_minor >= 0 ? '+' : '-'}{formatMoney(fromMinorUnits(Math.abs(item.net_minor)), project.default_currency)}
                </b>
                <small>{item.net_minor >= 0 ? '待收' : '应付'}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="category-card">
          <div className="section-header compact">
            <h3>分类支出</h3>
            <span>{categorySummary.length} 类</span>
          </div>
          {categorySummary.length ? (
            <div className="category-list">
              {categorySummary.map((item) => (
                <div className="category-row" key={item.category}>
                  <div>
                    <strong>{item.category}</strong>
                    <span>{item.count} 笔 · {item.percentage}%</span>
                  </div>
                  <b>{formatMoney(fromMinorUnits(item.amount_minor), project.default_currency)}</b>
                  <div className="category-bar" aria-label={`${item.category} 占比 ${item.percentage}%`}>
                    <span style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="category-empty">本周期还没有分类支出。</p>
          )}
        </section>

        <section className="transfer-card">
          <div className="transfer-title">
            <h3>最佳结算方案</h3>
            <button
              className="copy-transfer-button"
              type="button"
              onClick={copySettlementText}
              aria-label="复制结算文案"
            >
              <Copy size={18} />
            </button>
          </div>
          {transfers.length ? (
            transfers.map((transfer) => (
              <article className="transfer-row" key={`${transfer.from_member_id}-${transfer.to_member_id}`}>
                <span>{transfer.from_name}</span>
                <ArrowsLeftRight size={18} />
                <span>{transfer.to_name}</span>
                <strong>{formatMoney(fromMinorUnits(transfer.amount_minor), project.default_currency)}</strong>
                <button
                  className="copy-transfer-row-button"
                  type="button"
                  onClick={() => copyTransferInstruction(transfer)}
                  aria-label={`复制转账 ${formatTransferInstruction(transfer, project.default_currency)}`}
                >
                  <Copy size={16} />
                </button>
              </article>
            ))
          ) : (
            <p className="transfer-empty">当前没有需要互相转账的余额。</p>
          )}
          {shareNotice ? <p className="share-notice">{shareNotice}</p> : null}
        </section>

        <section className="section-block">
          <div className="section-header">
            <h3>历史结算</h3>
            <span>{settlementHistory.length} 条</span>
          </div>
          {settlementHistory.length ? (
            settlementHistory.map((item) => {
              const meta = settlementHistoryMeta(item);
              return (
                <button
                  className="history-row"
                  key={item.id ?? item.created_at}
                  type="button"
                  onClick={() => setSelectedHistorySnapshot(item)}
                >
                  <CheckCircle size={25} />
                  <div>
                    <strong>{item.period_label ?? activePeriod.label} 结算</strong>
                    <span>{meta.memberCount}人参与 · {meta.transferCount}笔转账</span>
                    <small>{meta.transferSummary}</small>
                  </div>
                  <div>
                    <strong>{formatMoney(fromMinorUnits(meta.totalMinor), project.default_currency)}</strong>
                    <span>{new Date(item.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="history-empty">还没有历史结算。</p>
          )}
          {appError ? <p className="error-text" role="alert">{appError}</p> : null}
        </section>
      </main>
      <div className="bottom-actions nav-offset">
        <button
          className={`primary-button ${settledNotice ? 'settled' : ''}`}
          disabled={isBusy || expenses.length === 0}
          onClick={() => setSettlementConfirmOpen(true)}
        >
          <CheckCircle size={22} weight="fill" />
          {settledNotice ? '结算成功' : expenses.length === 0 ? '暂无待结算账单' : '标记为已结算'}
        </button>
      </div>
      {settledNotice ? <div className="toast">{settledNotice}</div> : null}
      {selectedHistorySnapshot ? (
        <SettlementHistoryDetail
          project={project}
          snapshot={selectedHistorySnapshot}
          onClose={() => setSelectedHistorySnapshot(null)}
        />
      ) : null}
      {settlementConfirmOpen ? (
        <SettlementConfirmDialog
          project={project}
          expenses={expenses}
          transfers={transfers}
          isBusy={isBusy}
          onCancel={() => setSettlementConfirmOpen(false)}
          onConfirm={() => {
            setSettlementConfirmOpen(false);
            onSettled();
          }}
        />
      ) : null}
      <BottomNav active="stats" onDetails={onBack} onSettings={onOpenSettings} />
    </div>
  );
}

function ProjectSettingsSheet({
  project,
  activePeriod,
  members,
  expenses,
  settlementHistory,
  onClose,
  onSwitchProject,
  onSaveSettings,
  appError,
  isBusy,
}) {
  const [copyNotice, setCopyNotice] = useState('');
  const [projectName, setProjectName] = useState(project.name);
  const [budgetAmount, setBudgetAmount] = useState(
    project.budget_amount_minor == null ? '' : String(fromMinorUnits(project.budget_amount_minor)),
  );
  const [settingsError, setSettingsError] = useState('');
  const totalMinor = expenses.reduce((sum, expense) => sum + expense.converted_amount_minor, 0);
  const budgetMinor = project.budget_amount_minor ?? 0;
  const projectTypeLabel = project.project_type === 'roommate' ? '合租账本' : '朋友出游';
  const budgetLabel = budgetMinor > 0 ? formatMoney(fromMinorUnits(budgetMinor), project.default_currency) : '未设置';
  const rows = [
    ['项目类型', projectTypeLabel],
    ['项目码', project.code],
    ['结算币种', project.default_currency],
    ['预算', budgetLabel],
    ['当前周期', activePeriod.label],
    ['成员', `${members.length} 人`],
    ['本周期账单', `${expenses.length} 笔 · ${formatMoney(fromMinorUnits(totalMinor), project.default_currency)}`],
    ['历史结算', `${settlementHistory.length} 条`],
  ];

  const copyInvite = async () => {
    const inviteText = buildProjectInviteText({
      projectName: project.name,
      code: project.code,
      appUrl: createProjectInviteUrl(project.code),
    });

    try {
      await navigator.clipboard.writeText(inviteText);
      setCopyNotice('邀请文案已复制');
    } catch {
      window.prompt('复制邀请文案', inviteText);
      setCopyNotice('可手动复制邀请文案');
    }
  };

  const copyProjectCode = async () => {
    try {
      await navigator.clipboard.writeText(project.code);
      setCopyNotice('项目码已复制');
    } catch {
      window.prompt('复制项目码', project.code);
      setCopyNotice('可手动复制项目码');
    }
  };

  const copyInviteLink = async () => {
    const inviteUrl = createProjectInviteUrl(project.code);

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyNotice('邀请链接已复制');
    } catch {
      window.prompt('复制邀请链接', inviteUrl);
      setCopyNotice('可手动复制邀请链接');
    }
  };

  const exportExpenses = () => {
    const csv = buildExpenseCsv({ project, period: activePeriod, members, expenses });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = createExpenseExportFilename({ project, period: activePeriod });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setCopyNotice('本周期账单 CSV 已导出');
  };

  const exportSettlementHistory = () => {
    const csv = buildSettlementHistoryCsv({ project, settlementHistory });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = createSettlementHistoryExportFilename({ project });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setCopyNotice(settlementHistory.length ? '历史结算 CSV 已导出' : '已导出空的历史结算模板');
  };

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="关闭" />
      <section className="settings-sheet">
        <div className="sheet-handle" />
        <div className="settings-header">
          <h2>项目设置</h2>
          <p>{project.name}</p>
        </div>
        <div className="settings-list">
          {rows.map(([label, value]) => (
            <div className="settings-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <form
          className="settings-edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const normalizedBudget = budgetAmount.trim();
            const parsedBudget = Number(normalizedBudget);

            if (!projectName.trim()) {
              setSettingsError('请输入项目名称');
              return;
            }
            if (normalizedBudget && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
              setSettingsError('请输入有效预算');
              return;
            }

            setSettingsError('');
            const saved = await onSaveSettings({ name: projectName.trim(), budgetAmount: normalizedBudget });
            if (saved) setCopyNotice('项目设置已保存');
          }}
        >
          <label className="form-field">
            <span>项目名称</span>
            <input
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
                setSettingsError('');
              }}
            />
          </label>
          <label className="form-field">
            <span>{project.project_type === 'roommate' ? '月度预算' : '出游预算'}（可选）</span>
            <input
              value={budgetAmount}
              inputMode="decimal"
              onChange={(event) => {
                setBudgetAmount(event.target.value);
                setSettingsError('');
              }}
              placeholder="例如：3000"
            />
          </label>
          {settingsError ? <p className="error-text" role="alert">{settingsError}</p> : null}
          {appError ? <p className="error-text" role="alert">{appError}</p> : null}
          <button className="secondary-button settings-save-button" type="submit" disabled={isBusy}>
            {isBusy ? '保存中...' : '保存设置'}
          </button>
        </form>
        <button className="primary-button" type="button" onClick={copyInvite}>
          <Copy size={20} />
          复制邀请文案
        </button>
        <button className="secondary-button settings-action-button" type="button" onClick={copyProjectCode}>
          <Copy size={20} />
          复制项目码
        </button>
        <button className="secondary-button settings-action-button" type="button" onClick={copyInviteLink}>
          <ShareNetwork size={20} />
          复制邀请链接
        </button>
        {copyNotice ? <p className="settings-notice">{copyNotice}</p> : null}
        <button className="secondary-button settings-export-button" type="button" onClick={exportExpenses}>
          <DownloadSimple size={20} />
          导出本周期明细
        </button>
        <button className="secondary-button settings-export-button" type="button" onClick={exportSettlementHistory}>
          <DownloadSimple size={20} />
          导出历史结算
        </button>
        <button className="switch-project-button" type="button" onClick={onSwitchProject}>
          返回项目列表
          <small>仅退出当前设备，不删除账本数据</small>
        </button>
        <button className="cancel-button" type="button" onClick={onClose}>关闭</button>
      </section>
    </div>
  );
}

function BottomNav({ active, onDetails, onStats, onSettings }) {
  const iconById = {
    details: <Receipt size={22} />,
    stats: <ChartBar size={22} />,
    settings: <GearSix size={22} />,
  };
  const items = createBottomNavItems({ onDetails, onStats, onSettings }).map((item) => ({
    ...item,
    icon: iconById[item.id],
    onClick: item.action,
  }));
  return (
    <nav className="bottom-nav" aria-label="项目导航">
      {items.map((item) => {
        const isActive = active === item.id;
        const disabled = item.disabled === true;
        return (
          <button
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'active' : ''}
            disabled={disabled}
            key={item.id}
            onClick={item.onClick}
            type="button"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function App() {
  const [screen, setScreen] = useState('entry');
  const [username, setUsername] = useState('');
  const [project, setProject] = useState(null);
  const [activePeriod, setActivePeriod] = useState(fallbackPeriod);
  const [members, setMembers] = useState(fallbackMembers);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [settledNotice, setSettledNotice] = useState('');
  const [settlementHistory, setSettlementHistory] = useState([]);
  const [expenses, setExpenses] = useState(fallbackExpenses);
  const [draftExpense, setDraftExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [deletingMember, setDeletingMember] = useState(null);
  const [appError, setAppError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [recentProjects, setRecentProjects] = useState(() => readRecentProjects());

  const currentProject = project || fallbackProject;

  const loadProjectState = useCallback(async (projectId) => {
    const detail = await fetchProjectDetail(projectId);
    const snapshots = await fetchSettlementSnapshots(projectId);
    setProject(detail.project);
    setActivePeriod(detail.activePeriod);
    setMembers(detail.members);
    setExpenses(detail.expenses);
    setSettlementHistory(snapshots);
    return { ...detail, settlementHistory: snapshots };
  }, []);

  useEffect(() => {
    if (!syncNotice) return undefined;
    const timer = window.setTimeout(() => setSyncNotice(''), 2500);
    return () => window.clearTimeout(timer);
  }, [syncNotice]);

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator) || !window.isSecureContext) {
      return undefined;
    }

    let cancelled = false;
    const registerServiceWorker = () => {
      if (cancelled) return;
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };

    if (document.readyState === 'complete') {
      registerServiceWorker();
      return () => {
        cancelled = true;
      };
    }

    window.addEventListener('load', registerServiceWorker, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', registerServiceWorker);
    };
  }, []);

  useEffect(() => {
    const session = readProjectSession();
    const inviteCode = readInviteCodeFromUrl();

    if (inviteCode) {
      if (session?.username) setUsername(session.username);
      setScreen('entry');
      return;
    }

    if (!session?.username) return;
    if (readRecentProjects().length > 1) {
      setUsername(session.username);
      setScreen('entry');
      return;
    }

    let cancelled = false;

    const restoreSession = async () => {
      setUsername(session.username);
      setAppError('');
      setIsBusy(true);

      try {
        if (hasBackendConfig && session.mode === 'backend' && session.projectId) {
          const detail = await loadProjectState(session.projectId);
          if (!cancelled) {
            setRecentProjects(rememberRecentProject({
              project: detail.project,
              username: session.username,
              mode: 'backend',
            }));
            setSettledNotice('');
            setScreen('home');
          }
          return;
        }

        if (!hasBackendConfig && session.mode === 'local' && session.code) {
          const stored = loadLocalProjectState(session.code);
          if (!stored) throw new Error('stored project not found');

          if (!cancelled) {
            setProject(stored.project);
            setActivePeriod(stored.activePeriod);
            setMembers(stored.members);
            setExpenses(stored.expenses);
            setSettlementHistory(stored.settlementHistory);
            setSettledNotice('');
            setScreen('home');
            setRecentProjects(rememberRecentProject({
              project: stored.project,
              username: session.username,
              mode: 'local',
            }));
          }
          return;
        }

        clearProjectSession();
      } catch {
        clearProjectSession();
        if (!cancelled) {
          setAppError('上次项目恢复失败，请重新输入项目码');
          setScreen('entry');
        }
      } finally {
        if (!cancelled) setIsBusy(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasBackendConfig || !project?.id) return undefined;

    let cancelled = false;
    let refreshTimer = null;
    const projectId = project.id;

    const scheduleRefresh = ({ notify = true } = {}) => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        if (cancelled) return;

        try {
          const detail = await loadProjectState(projectId);
          if (cancelled) return;

          setRecentProjects(rememberRecentProject({
            project: detail.project,
            username,
            mode: 'backend',
          }));
          if (notify) setSyncNotice('已同步最新多人变更');
        } catch {
          if (!cancelled) setSyncNotice('同步失败，请稍后重试');
        }
      }, 500);
    };

    const unsubscribe = subscribeProjectRealtime({
      projectId,
      onChange: scheduleRefresh,
      onStatusChange: (status) => {
        if (status === 'SUBSCRIBED') scheduleRefresh({ notify: false });
      },
    });

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [loadProjectState, project?.id, username]);

  const handleJoinProject = async (name, code) => {
    setUsername(name);
    setAppError('');

    if (!hasBackendConfig) {
      const stored = loadLocalProjectState(code);
      if (!stored) {
        setAppError('项目码不存在，请确认后重试');
        return;
      }

      const existingMember = findMemberByDisplayName(stored.members, name);
      const nextMembers = existingMember ? stored.members : [...stored.members, createLocalMember(name)];
      const nextState = { ...stored, members: nextMembers };

      saveLocalProjectState(nextState);
      writeProjectSession({ mode: 'local', username: name, code: nextState.project.code });
      setRecentProjects(rememberRecentProject({ project: nextState.project, username: name, mode: 'local' }));
      setProject(nextState.project);
      setActivePeriod(nextState.activePeriod);
      setMembers(nextState.members);
      setExpenses(nextState.expenses);
      setSettlementHistory(nextState.settlementHistory);
      setSettledNotice('');
      clearInviteCodeFromUrl();
      setScreen('home');
      return;
    }

    setIsBusy(true);
    try {
      const member = await joinProject({ code, displayName: name });
      await loadProjectState(member.project.id);
      writeProjectSession({ mode: 'backend', username: name, projectId: member.project.id });
      setRecentProjects(rememberRecentProject({ project: member.project, username: name, mode: 'backend' }));
      clearInviteCodeFromUrl();
      setScreen('home');
    } catch (error) {
      setAppError(error.message || '加入项目失败');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateProject = async (created) => {
    setAppError('');

    if (!hasBackendConfig) {
      const nextPeriod = {
        ...fallbackPeriod,
        id: `local-period-${Date.now()}`,
        project_id: `local-project-${created.code}`,
        label: createCurrentPeriodLabel(),
      };
      const nextProject = {
        ...fallbackProject,
        id: `local-project-${created.code}`,
        name: created.name,
        code: created.code,
        default_currency: created.currency,
        project_type: created.projectType,
        budget_amount_minor: created.budgetAmount.trim() ? toMinorUnits(created.budgetAmount) : null,
        active_period_id: nextPeriod.id,
      };
      const nextMembers = [{ id: 'local-member', display_name: created.username, initials: created.username[0], color: '#22c55e' }];
      const nextExpenses = [];
      const nextHistory = [];

      saveLocalProjectState({
        project: nextProject,
        activePeriod: nextPeriod,
        members: nextMembers,
        expenses: nextExpenses,
        settlementHistory: nextHistory,
      });
      writeProjectSession({ mode: 'local', username: created.username, code: nextProject.code });
      setRecentProjects(rememberRecentProject({ project: nextProject, username: created.username, mode: 'local' }));
      setProject(nextProject);
      setActivePeriod(nextPeriod);
      setMembers(nextMembers);
      setExpenses(nextExpenses);
      setSettlementHistory(nextHistory);
      setSettledNotice('');
      setScreen('home');
      return;
    }

    setIsBusy(true);
    try {
      const createdProject = await createProject({
        name: created.name,
        code: created.code,
        defaultCurrency: created.currency,
        displayName: created.username,
        projectType: created.projectType,
        budgetAmount: created.budgetAmount,
      });
      await loadProjectState(createdProject.id);
      writeProjectSession({ mode: 'backend', username: created.username, projectId: createdProject.id });
      setRecentProjects(rememberRecentProject({ project: createdProject, username: created.username, mode: 'backend' }));
      setScreen('home');
    } catch (error) {
      setAppError(error.message || '创建项目失败');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveExpense = async (draft) => {
    setAppError('');

    if (draft.mode === 'edit') {
      if (!hasBackendConfig) {
        const nextExpenses = expenses.map((expense) => (
          expense.id === draft.expenseId
            ? {
                ...expense,
                description: draft.description,
                original_amount_minor: toMinorUnits(draft.amount),
                original_currency: draft.currency,
                converted_amount_minor: toMinorUnits(draft.convertedAmount),
                project_currency: currentProject.default_currency,
                exchange_rate: draft.exchangeRate,
                exchange_rate_provider: draft.exchangeRateProvider,
                exchange_rate_timestamp: draft.exchangeRateTimestamp,
                payer_member_id: draft.payerMemberId,
                participant_member_ids: draft.participantMemberIds,
                source_type: draft.sourceType,
                source_name: draft.sourceName,
                ai_draft_id: draft.aiDraftId ?? null,
                created_at: draft.createdAt,
                category: draft.category,
                notes: draft.notes,
              }
            : expense
        ));

        saveLocalProjectState({
          project: currentProject,
          activePeriod,
          members,
          expenses: nextExpenses,
          settlementHistory,
        });
        setExpenses(nextExpenses);
        setDraftExpense(null);
        setSettledNotice('');
        setScreen('home');
        return;
      }

      setIsBusy(true);
      try {
        await updateExpense({ project: currentProject, ...draft });
        await loadProjectState(currentProject.id);
        setDraftExpense(null);
        setSettledNotice('');
        setScreen('home');
      } catch (error) {
        setAppError(error.message || '保存修改失败');
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (!hasBackendConfig) {
      const nextExpense = {
        id: `local-expense-${Date.now()}`,
        description: draft.description,
        original_amount_minor: toMinorUnits(draft.amount),
        original_currency: draft.currency,
        converted_amount_minor: toMinorUnits(draft.convertedAmount),
        project_currency: currentProject.default_currency,
        exchange_rate: draft.exchangeRate,
        exchange_rate_provider: draft.exchangeRateProvider,
        exchange_rate_timestamp: draft.exchangeRateTimestamp,
        payer_member_id: draft.payerMemberId,
        participant_member_ids: draft.participantMemberIds,
        source_type: draft.sourceType,
        source_name: draft.sourceName,
        ai_draft_id: draft.aiDraftId ?? null,
        created_at: draft.createdAt,
        category: draft.category,
        notes: draft.notes,
      };
      const nextExpenses = [nextExpense, ...expenses];

      saveLocalProjectState({
        project: currentProject,
        activePeriod,
        members,
        expenses: nextExpenses,
        settlementHistory,
      });
      setExpenses(nextExpenses);
      setDraftExpense(null);
      setSettledNotice('');
      setScreen('home');
      return;
    }

    setIsBusy(true);
    try {
      await createExpense({ project: currentProject, ...draft });
      await loadProjectState(currentProject.id);
      setDraftExpense(null);
      setSettledNotice('');
      setScreen('home');
    } catch (error) {
      setAppError(error.message || '保存账单失败');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelDraft = async () => {
    const draft = draftExpense;

    setAppError('');
    setDraftExpense(null);
    setScreen('home');

    if (!hasBackendConfig || draft?.mode === 'edit' || !draft?.aiDraftId) return;

    try {
      await discardAiDraft({
        projectId: currentProject.id,
        aiDraftId: draft.aiDraftId,
        supabase,
      });
    } catch {
      setAppError('草稿状态同步失败，但账单未保存');
    }
  };

  const requestDeleteExpense = (expense) => {
    setAppError('');
    setDeletingExpense(expense);
  };

  const handleDeleteExpense = async (expense) => {
    setAppError('');

    if (!hasBackendConfig) {
      const nextExpenses = expenses.filter((item) => item.id !== expense.id);
      saveLocalProjectState({
        project: currentProject,
        activePeriod,
        members,
        expenses: nextExpenses,
        settlementHistory,
      });
      setExpenses(nextExpenses);
      setSettledNotice('');
      setDeletingExpense(null);
      return;
    }

    setIsBusy(true);
    try {
      await deleteExpense({ projectId: currentProject.id, expenseId: expense.id });
      await loadProjectState(currentProject.id);
      setSettledNotice('');
      setDeletingExpense(null);
    } catch (error) {
      setAppError(error.message || '删除账单失败');
    } finally {
      setIsBusy(false);
    }
  };

  const handleEditExpense = (expense) => {
    setAppError('');
    setDraftExpense(createDraftFromExpense(expense));
    setScreen('confirm');
  };

  const handleUpdateMember = async (member, displayName) => {
    setAppError('');
    const normalizedName = normalizeMemberDisplayName(displayName);
    const duplicateMember = findMemberByDisplayName(members, normalizedName);
    const currentMember = findMemberByDisplayName(members, username);
    const isCurrentMember = currentMember?.id === member.id;

    if (duplicateMember && duplicateMember.id !== member.id) {
      setAppError('成员昵称已存在');
      return;
    }

    const applyUpdatedMember = (updatedMember) => {
      const nextMembers = members.map((item) => (
        item.id === updatedMember.id
          ? {
              ...item,
              ...updatedMember,
              display_name: normalizedName,
              initials: normalizedName.slice(0, 1).toUpperCase(),
            }
          : item
      ));

      if (!hasBackendConfig) {
        saveLocalProjectState({
          project: currentProject,
          activePeriod,
          members: nextMembers,
          expenses,
          settlementHistory,
        });
      }

      if (isCurrentMember) {
        setUsername(normalizedName);
        writeProjectSession(
          hasBackendConfig
            ? { mode: 'backend', username: normalizedName, projectId: currentProject.id }
            : { mode: 'local', username: normalizedName, code: currentProject.code }
        );
      }

      setMembers(nextMembers);
      setEditingMember(null);
      setMemberDialogOpen(false);
    };

    if (!hasBackendConfig) {
      applyUpdatedMember({ ...member, display_name: normalizedName });
      return;
    }

    setIsBusy(true);
    try {
      const updatedMember = await updateProjectMember({
        projectId: currentProject.id,
        memberId: member.id,
        displayName: normalizedName,
      });
      applyUpdatedMember(updatedMember);
    } catch (error) {
      setAppError(error.message || '保存成员失败');
    } finally {
      setIsBusy(false);
    }
  };

  const requestDeleteMember = (member) => {
    setAppError('');
    const currentMember = findMemberByDisplayName(members, username);

    if (currentMember?.id === member.id) {
      setAppError('不能删除当前使用的成员');
      return;
    }

    const isUsedByExpense = expenses.some((expense) => (
      expense.payer_member_id === member.id
      || (expense.participant_member_ids ?? []).includes(member.id)
    ));

    if (isUsedByExpense) {
      setAppError('该成员已有账单记录，不能删除');
      return;
    }

    setDeletingMember(member);
  };

  const handleDeleteMember = async (member) => {
    setAppError('');

    const nextMembers = members.filter((item) => item.id !== member.id);

    if (!hasBackendConfig) {
      saveLocalProjectState({
        project: currentProject,
        activePeriod,
        members: nextMembers,
        expenses,
        settlementHistory,
      });
      setMembers(nextMembers);
      setEditingMember(null);
      setMemberDialogOpen(false);
      setDeletingMember(null);
      return;
    }

    setIsBusy(true);
    try {
      await deleteProjectMember({ projectId: currentProject.id, memberId: member.id });
      setMembers(nextMembers);
      setEditingMember(null);
      setMemberDialogOpen(false);
      setDeletingMember(null);
    } catch (error) {
      setAppError(error.message || '删除成员失败');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmitMemberDialog = (displayName, member) => {
    if (!member) return;
    handleUpdateMember(member, displayName);
  };

  const copyProjectInvite = async () => {
    const inviteText = buildProjectInviteText({
      projectName: currentProject.name,
      code: currentProject.code,
      appUrl: createProjectInviteUrl(currentProject.code),
    });

    try {
      await navigator.clipboard.writeText(inviteText);
    } catch {
      window.prompt('复制邀请文案', inviteText);
    }
  };

  const openDraftForConfirmation = async ({ sourceType, text = '', file }) => {
    setAppError('');
    setIsBusy(true);

    try {
      let parsedDraft = buildLocalDraft(sourceType, text);
      const localDraft = parsedDraft;

      if (sourceType !== 'manual' && (hasBackendConfig || sourceType === 'text')) {
        let aiDraftId = null;
        try {
          const response = hasBackendConfig
            ? await createAiDraft({ projectId: currentProject.id, sourceType, text, file })
            : { draft: buildLocalDraft(sourceType, text) };
          parsedDraft = {
            ...(response.draft ?? parsedDraft),
            createdAt: localDraft.createdAt || response.draft?.createdAt || '',
          };
          aiDraftId = response.aiDraftId ?? null;
        } catch {
          parsedDraft = buildLocalDraft(sourceType, text);
        }
        parsedDraft = { ...parsedDraft, aiDraftId };
      }

      const rate = await resolveExchangeRate({
        fromCurrency: parsedDraft.currency,
        toCurrency: currentProject.default_currency,
      });

      const inferenceText = [text, parsedDraft.description].filter(Boolean).join('\n');
      const payerMemberId = inferPayerMemberId({
        members,
        text: inferenceText,
        payerName: parsedDraft.payerName,
      });
      const participantMemberIds = inferParticipantMemberIds({
        members,
        text: inferenceText,
        participantNames: parsedDraft.participantNames,
        payerMemberId,
      });

      setDraftExpense({
        ...parsedDraft,
        sourceType,
        sourceName: file?.name,
        aiDraftId: parsedDraft.aiDraftId ?? null,
        payerMemberId,
        participantMemberIds,
        exchangeRate: rate.rate,
        exchangeRateProvider: rate.provider,
        exchangeRateTimestamp: rate.timestamp,
        createdAt: parsedDraft.createdAt || new Date().toISOString(),
      });
      setAiOpen(false);
      setScreen('confirm');
    } catch (error) {
      setAppError(error.message || 'AI 识别失败，请手动填写账单');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSettleActivePeriod = async () => {
    setAppError('');
    setSettledNotice('');

    if (expenses.length === 0) return;

    if (!hasBackendConfig) {
      const { balances, transfers } = buildCurrentSettlement({ members, expenses });
      const snapshotPayload = buildSettlementSnapshot({
        project: currentProject,
        period: activePeriod,
        expenses,
        balances,
        transfers,
      });
      const snapshot = {
        ...snapshotPayload,
        id: `local-snapshot-${Date.now()}`,
        created_at: new Date().toISOString(),
        total_minor: expenses.reduce((sum, expense) => sum + expense.converted_amount_minor, 0),
      };
      const nextPeriod = {
        ...fallbackPeriod,
        id: `local-period-${Date.now()}`,
        project_id: currentProject.id,
        label: createNextPeriodLabel(activePeriod.label),
        started_at: new Date().toISOString(),
      };
      const nextHistory = [snapshot, ...settlementHistory];
      const nextProject = { ...currentProject, active_period_id: nextPeriod.id };

      saveLocalProjectState({
        project: nextProject,
        activePeriod: nextPeriod,
        members,
        expenses: [],
        settlementHistory: nextHistory,
      });
      setSettlementHistory(nextHistory);
      setExpenses([]);
      setActivePeriod(nextPeriod);
      setProject(nextProject);
      setSettledNotice(`周期 ${activePeriod.label} 已归档至历史结算`);
      return;
    }

    setIsBusy(true);
    try {
      const { snapshot, nextPeriod } = await settleActivePeriod({
        project: currentProject,
        period: activePeriod,
        members,
        expenses,
      });
      setSettlementHistory((items) => [snapshot, ...items]);
      setExpenses([]);
      setActivePeriod(nextPeriod);
      setProject((current) => ({ ...(current ?? currentProject), active_period_id: nextPeriod.id }));
      setSettledNotice(`周期 ${activePeriod.label} 已归档至历史结算`);
    } catch (error) {
      setAppError(error.message || '结算失败');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSwitchProject = () => {
    clearProjectSession();
    setScreen('entry');
    setProject(null);
    setActivePeriod(fallbackPeriod);
    setMembers(fallbackMembers);
    setExpenses(fallbackExpenses);
    setSettlementHistory([]);
    setDraftExpense(null);
    setSettledNotice('');
    setAppError('');
    setAiOpen(false);
    setMemberDialogOpen(false);
    setEditingMember(null);
    setSettingsOpen(false);
    setDeletingExpense(null);
    setDeletingMember(null);
  };

  const handleSaveProjectSettings = async ({ name, budgetAmount }) => {
    setAppError('');

    if (!hasBackendConfig) {
      const nextProject = {
        ...currentProject,
        name,
        budget_amount_minor: budgetAmount ? toMinorUnits(budgetAmount) : null,
      };

      saveLocalProjectState({
        project: nextProject,
        activePeriod,
        members,
        expenses,
        settlementHistory,
      });
      setProject(nextProject);
      setRecentProjects(rememberRecentProject({ project: nextProject, username, mode: 'local' }));
      return true;
    }

    setIsBusy(true);
    try {
      const updatedProject = await updateProjectSettings({
        projectId: currentProject.id,
        name,
        budgetAmount,
      });
      setProject((current) => ({ ...(current ?? currentProject), ...updatedProject }));
      setRecentProjects(rememberRecentProject({ project: updatedProject, username, mode: 'backend' }));
      return true;
    } catch (error) {
      setAppError(error.message || '保存项目设置失败');
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenRecentProject = async (recentProject) => {
    setUsername(recentProject.username);
    setAppError('');
    setIsBusy(true);

    try {
      if (hasBackendConfig && recentProject.mode === 'backend') {
        await loadProjectState(recentProject.id);
        writeProjectSession({ mode: 'backend', username: recentProject.username, projectId: recentProject.id });
        setRecentProjects(rememberRecentProject({
          project: recentProject,
          username: recentProject.username,
          mode: 'backend',
        }));
        setSettledNotice('');
        setScreen('home');
        return;
      }

      if (!hasBackendConfig && recentProject.mode === 'local') {
        const stored = loadLocalProjectState(recentProject.code);
        if (!stored) throw new Error('stored project not found');

        writeProjectSession({ mode: 'local', username: recentProject.username, code: stored.project.code });
        setRecentProjects(rememberRecentProject({
          project: stored.project,
          username: recentProject.username,
          mode: 'local',
        }));
        setProject(stored.project);
        setActivePeriod(stored.activePeriod);
        setMembers(stored.members);
        setExpenses(stored.expenses);
        setSettlementHistory(stored.settlementHistory);
        setSettledNotice('');
        setScreen('home');
        return;
      }

      throw new Error('recent project is unavailable in this mode');
    } catch {
      clearProjectSession();
      setRecentProjects(forgetRecentProject(recentProject.id));
      setAppError('最近项目打开失败，请用项目码重新加入');
      setScreen('entry');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="phone">
        {screen === 'entry' && (
          <EntryScreen
            initialName={username}
            initialJoinCode={readInviteCodeFromUrl()}
            onCreateProject={(name) => {
              setUsername(name);
              setAppError('');
              setScreen('create');
            }}
            onJoinProject={handleJoinProject}
            onOpenRecentProject={handleOpenRecentProject}
            onForgetRecentProject={(projectId) => {
              setRecentProjects(forgetRecentProject(projectId));
              setAppError('');
            }}
            recentProjects={recentProjects}
            appError={appError}
            isBusy={isBusy}
          />
        )}
        {screen === 'create' && (
          <CreateProjectScreen
            username={username}
            onBack={() => setScreen('entry')}
            onCreated={handleCreateProject}
            appError={appError}
            isBusy={isBusy}
          />
        )}
        {screen === 'home' && (
          <ProjectHome
            project={currentProject}
            activePeriod={activePeriod}
            members={members}
            expenses={expenses}
            currentUsername={username}
            onOpenAi={() => setAiOpen(true)}
            onOpenSettlement={() => setScreen('settlement')}
            onInviteMember={copyProjectInvite}
            onEditMember={(member) => {
              setAppError('');
              setEditingMember(member);
              setMemberDialogOpen(true);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            onEditExpense={handleEditExpense}
            onDeleteExpense={requestDeleteExpense}
            isBusy={isBusy}
          />
        )}
        {screen === 'confirm' && draftExpense && (
          <ConfirmBill
            project={currentProject}
            members={members}
            draft={draftExpense}
            onBack={handleCancelDraft}
            onSave={handleSaveExpense}
            onResolveRate={resolveExchangeRate}
            appError={appError}
            isBusy={isBusy}
          />
        )}
        {screen === 'settlement' && (
          <SettlementScreen
            project={currentProject}
            activePeriod={activePeriod}
            members={members}
            expenses={expenses}
            settlementHistory={settlementHistory}
            onBack={() => setScreen('home')}
            onOpenSettings={() => setSettingsOpen(true)}
            onSettled={handleSettleActivePeriod}
            settledNotice={settledNotice}
            isBusy={isBusy}
            appError={appError}
          />
        )}
        {aiOpen ? (
          <AiSheet
            onClose={() => setAiOpen(false)}
            onConfirm={openDraftForConfirmation}
            isBusy={isBusy}
          />
        ) : null}
        {memberDialogOpen ? (
          <MemberDialog
            member={editingMember}
            onClose={() => {
              setEditingMember(null);
              setMemberDialogOpen(false);
            }}
            onSubmit={handleSubmitMemberDialog}
            onDelete={requestDeleteMember}
            appError={appError}
            isBusy={isBusy}
          />
        ) : null}
        {settingsOpen ? (
          <ProjectSettingsSheet
            project={currentProject}
            activePeriod={activePeriod}
            members={members}
            expenses={expenses}
            settlementHistory={settlementHistory}
            onClose={() => setSettingsOpen(false)}
            onSwitchProject={handleSwitchProject}
            onSaveSettings={handleSaveProjectSettings}
            appError={appError}
            isBusy={isBusy}
          />
        ) : null}
        {deletingExpense ? (
          <DeleteExpenseConfirmDialog
            project={currentProject}
            expense={deletingExpense}
            members={members}
            onCancel={() => setDeletingExpense(null)}
            onConfirm={handleDeleteExpense}
            isBusy={isBusy}
          />
        ) : null}
        {deletingMember ? (
          <DeleteMemberConfirmDialog
            member={deletingMember}
            onCancel={() => setDeletingMember(null)}
            onConfirm={handleDeleteMember}
            isBusy={isBusy}
          />
        ) : null}
        {syncNotice ? <div className="toast sync-toast" role="status">{syncNotice}</div> : null}
      </div>
      <InstallAppPrompt />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
