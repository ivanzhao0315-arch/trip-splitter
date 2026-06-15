import React, { useState } from 'react';
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
  GearSix,
  HouseLine,
  Image,
  ListChecks,
  Plus,
  Receipt,
  ShareNetwork,
  Sparkle,
  Tag,
  UsersThree,
} from '@phosphor-icons/react';
import { createProjectCode, normalizeProjectCode } from './domain/codes';
import { parseExpenseText } from './domain/aiParser';
import { formatMoney, fromMinorUnits, toMinorUnits } from './domain/money';
import { inferPayerMemberId, inferParticipantMemberIds } from './domain/memberInference';
import { buildSettlementSnapshot, createCurrentPeriodLabel, createNextPeriodLabel } from './domain/periods';
import { buildSettlementShareText } from './domain/settlementShare';
import { createAiDraft } from './services/aiDraftService';
import { createExpense, fetchProjectDetail } from './services/expenseService';
import { resolveExchangeRateWithFallback } from './services/exchangeRateService';
import { hasBackendConfig } from './services/apiClient';
import { addProjectMember, createProject, joinProject } from './services/projectService';
import { buildCurrentSettlement, fetchSettlementSnapshots, settleActivePeriod } from './services/settlementService';
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

const currencies = [
  { code: 'CNY', label: 'CNY - 人民币 (¥)' },
  { code: 'USD', label: 'USD - 美元 ($)' },
  { code: 'JPY', label: 'JPY - 日元 (¥)' },
  { code: 'EUR', label: 'EUR - 欧元 (€)' },
  { code: 'HKD', label: 'HKD - 港币 ($)' },
];

const fallbackRates = {
  CNY: { USD: 0.14, EUR: 0.13, JPY: 21.8, HKD: 1.08 },
  USD: { CNY: 7.25, EUR: 0.93, JPY: 157.4, HKD: 7.82 },
  EUR: { CNY: 7.8, USD: 1.08, JPY: 169.2, HKD: 8.42 },
  JPY: { CNY: 0.046, USD: 0.0064, EUR: 0.0059, HKD: 0.05 },
  HKD: { CNY: 0.93, USD: 0.128, EUR: 0.119, JPY: 20.1 },
};

function buildLocalDraft(sourceType, text = '') {
  if (sourceType === 'text') {
    return parseExpenseText(text);
  }

  return {
    amount: 0,
    currency: 'CNY',
    description: '',
    confidence: 0,
    payerName: '',
    participantNames: [],
  };
}

async function resolveExchangeRate({ fromCurrency, toCurrency }) {
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

function sourceTypeLabel(sourceType) {
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
  return `原 ${originalAmount} · ${expense.exchange_rate_provider ?? '汇率'}`;
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

  const copyProjectCode = async () => {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopyNotice('项目码已复制');
    } catch {
      window.prompt('复制项目码', code);
      setCopyNotice('可手动复制项目码');
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
          <button className="code-pill" type="button" onClick={copyProjectCode} aria-label="复制项目码">
            <span>#{code}</span>
            <Copy size={15} />
          </button>
          {copyNotice ? <span className="code-copy-notice">{copyNotice}</span> : null}
        </div>
      ) : null}
    </header>
  );
}

function EntryScreen({ onCreateProject, onJoinProject, appError, isBusy }) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const requireName = () => {
    if (!name.trim()) {
      setError('请输入昵称后再继续');
      return false;
    }
    setError('');
    return true;
  };

  return (
    <div className="screen entry-screen">
      <TopBar title="分账助手" />
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
          <p>透明、公平、高效的群组分账工具</p>
        </section>

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
            <div className="text-field">
              <Tag size={21} />
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeProjectCode(event.target.value))}
                maxLength={4}
                placeholder="4位项目码"
                className="code-input"
              />
            </div>
            <button
              className="secondary-button"
              disabled={isBusy}
              onClick={() => {
                if (requireName() && joinCode.length === 4) onJoinProject(name.trim(), joinCode);
              }}
            >
              {isBusy ? '处理中...' : '加入'}
            </button>
          </div>
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

function ProjectHome({ project, activePeriod, members, expenses, onOpenAi, onOpenSettlement, onAddMember }) {
  const totalMinor = expenses.reduce((sum, item) => sum + item.converted_amount_minor, 0);
  const budgetMinor = project.budget_amount_minor ?? 0;
  const remainingMinor = budgetMinor - totalMinor;
  const budgetProgress = budgetMinor > 0 ? Math.min(100, Math.round((totalMinor / budgetMinor) * 100)) : 0;
  const projectTypeLabel = project.project_type === 'roommate' ? '合租账本' : '朋友出游';
  const budgetLabel = project.project_type === 'roommate' ? '月度预算剩余' : '预算剩余';
  const remainingText = `${remainingMinor < 0 ? '-' : ''}${formatMoney(fromMinorUnits(Math.abs(remainingMinor)), project.default_currency)}`;
  const memberById = new Map(members.map((member) => [member.id, member]));

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
              <div className="budget-progress" aria-label={`预算已使用 ${budgetProgress}%`}>
                <span style={{ width: `${budgetProgress}%` }} />
              </div>
            ) : null}
          </article>
          <article className="mini-card member-card">
            <div>
              <p>成员</p>
              <strong>{members.length} 人</strong>
            </div>
            <div className="avatar-stack">
              {members.map((member) => <Avatar key={member.id} member={member} size="sm" />)}
            </div>
          </article>
        </section>

        <section className="section-block">
          <div className="section-header">
            <h3>小组成员</h3>
            <button onClick={onAddMember}>管理成员</button>
          </div>
          <div className="member-strip">
            {members.map((member) => (
              <div className="member-chip" key={member.id}>
                <Avatar member={member} />
                <span>{memberName(member)}</span>
              </div>
            ))}
            <button className="add-member" onClick={onAddMember}>
              <Plus size={20} />
              <span>添加</span>
            </button>
          </div>
        </section>

        <section className="section-block">
          <div className="section-header">
            <h3>最近明细</h3>
            <button onClick={onOpenSettlement}>查看结算</button>
          </div>
          <div className="expense-list">
            {expenses.map((expense) => {
              const originalLabel = originalAmountLabel(expense, project.default_currency);
              return (
                <article className="expense-row" key={expense.id}>
                  <div className="expense-icon"><Receipt size={22} /></div>
                  <div className="expense-copy">
                    <h4>{expense.description}</h4>
                    <p>
                      {memberName(memberById.get(expense.payer_member_id))}支付 · {expense.participant_member_ids.length}人平分
                      {expense.source_name ? ` · ${sourceTypeLabel(expense.source_type)} ${expense.source_name}` : ''}
                    </p>
                  </div>
                  <div className="expense-amount">
                    <strong>{formatMoney(fromMinorUnits(expense.converted_amount_minor), project.default_currency)}</strong>
                    {originalLabel ? <small>{originalLabel}</small> : null}
                    <span>{new Date(expense.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <button className="ai-fab" onClick={onOpenAi}>
        <Sparkle size={22} weight="fill" />
        AI 记账
      </button>
      <BottomNav active="details" onStats={onOpenSettlement} onMembers={onAddMember} />
    </div>
  );
}

function MemberDialog({ onClose, onSubmit, appError, isBusy }) {
  const [displayName, setDisplayName] = useState('');
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
          onSubmit(displayName.trim());
        }}
      >
        <h2>添加成员</h2>
        <label className="form-field">
          <span>成员昵称</span>
          <input
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setError('');
            }}
            placeholder="例：张三"
          />
        </label>
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        {appError ? <p className="error-text" role="alert">{appError}</p> : null}
        <button className="primary-button" type="submit" disabled={isBusy}>
          {isBusy ? '添加中...' : '添加成员'}
        </button>
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
  const [amount, setAmount] = useState(String(draft.amount));
  const [currency, setCurrency] = useState(draft.currency);
  const [description, setDescription] = useState(draft.description);
  const [exchangeRate, setExchangeRate] = useState(draft.exchangeRate);
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
  const converted = numericAmount * exchangeRate;
  const canSave = Boolean(payer?.id && participantIds.length && Number.isFinite(numericAmount) && numericAmount > 0);

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
      setExchangeRateProvider(rate.provider);
      setExchangeRateTimestamp(rate.timestamp);
    } catch (error) {
      setLocalError(error.message || '汇率刷新失败');
    }
  };

  return (
    <div className="screen">
      <TopBar title="确认账单" code={project.code} onBack={onBack} />
      <main className="content confirm-content">
        <section className="amount-card">
          <label>金额</label>
          <h2>{Number.isFinite(numericAmount) ? formatMoney(numericAmount, currency) : `${currency} --`}</h2>
          <p>{currency} · AI 置信度 {Math.round((draft.confidence ?? 0) * 100)}%</p>
        </section>

        <section className="fx-card">
          <div>
            <p><ArrowsLeftRight size={17} /> 汇率 1 {currency} = {exchangeRate.toFixed(4)} {project.default_currency}</p>
            <strong>折合 {Number.isFinite(converted) ? formatMoney(converted, project.default_currency) : '--'}</strong>
            <small>{exchangeRateProvider} · {new Date(exchangeRateTimestamp).toLocaleString('zh-CN')}</small>
          </div>
          <button disabled={isBusy} onClick={() => refreshRate()}>刷新汇率</button>
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
          {manualOpen ? (
            <p className="manual-note">
              {(draft.confidence ?? 0) === 0
                ? '当前草稿需要手动补全金额、币种、付款人、参与人和描述。'
                : '可在保存前修正 AI 识别的金额、币种、付款人、参与人和描述。'}
            </p>
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
            description,
            payerMemberId: payer.id,
            participantMemberIds: participantIds,
            sourceType: draft.sourceType,
            sourceName: draft.sourceName,
          })}
        >
          {isBusy ? '保存中...' : '保存账单'}
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
  };
}

function SettlementScreen({
  project,
  activePeriod,
  members,
  expenses,
  settlementHistory,
  onBack,
  onOpenMembers,
  onSettled,
  settledNotice,
  isBusy,
  appError,
}) {
  const { balances, transfers } = buildCurrentSettlement({ members, expenses });
  const [shareNotice, setShareNotice] = useState('');

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

  return (
    <div className="screen">
      <TopBar title="结算汇总" code={project.code} onBack={onBack} />
      <main className="content with-nav settlement-content">
        <section className="period-card">
          <div>
            <span>当前周期</span>
            <strong><CalendarBlank size={20} />{activePeriod.label}</strong>
          </div>
          <button>切换周期 <CaretDown size={17} /></button>
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
            <button>查看全部</button>
          </div>
          {settlementHistory.length ? (
            settlementHistory.map((item) => {
              const meta = settlementHistoryMeta(item);
              return (
                <article className="history-row" key={item.id ?? item.created_at}>
                  <CheckCircle size={25} />
                  <div>
                    <strong>{item.period_label ?? activePeriod.label} 结算</strong>
                    <span>{meta.memberCount}人参与 · {meta.transferCount}笔转账</span>
                  </div>
                  <div>
                    <strong>{formatMoney(fromMinorUnits(meta.totalMinor), project.default_currency)}</strong>
                    <span>{new Date(item.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </article>
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
          onClick={onSettled}
        >
          <CheckCircle size={22} weight="fill" />
          {settledNotice ? '结算成功' : expenses.length === 0 ? '暂无待结算账单' : '标记为已结算'}
        </button>
      </div>
      {settledNotice ? <div className="toast">{settledNotice}</div> : null}
      <BottomNav active="stats" onDetails={onBack} onMembers={onOpenMembers} />
    </div>
  );
}

function BottomNav({ active, onDetails, onStats, onMembers }) {
  const items = [
    { id: 'details', label: '明细', icon: <Receipt size={22} />, onClick: onDetails },
    { id: 'stats', label: '统计', icon: <ChartBar size={22} />, onClick: onStats },
    { id: 'members', label: '成员', icon: <UsersThree size={22} />, onClick: onMembers },
    { id: 'settings', label: '设置', icon: <GearSix size={22} />, disabled: true },
  ];
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
  const [aiOpen, setAiOpen] = useState(false);
  const [settledNotice, setSettledNotice] = useState('');
  const [settlementHistory, setSettlementHistory] = useState([]);
  const [expenses, setExpenses] = useState(fallbackExpenses);
  const [draftExpense, setDraftExpense] = useState(null);
  const [appError, setAppError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const currentProject = project || fallbackProject;

  const loadProjectState = async (projectId) => {
    const detail = await fetchProjectDetail(projectId);
    const snapshots = await fetchSettlementSnapshots(projectId);
    setProject(detail.project);
    setActivePeriod(detail.activePeriod);
    setMembers(detail.members);
    setExpenses(detail.expenses);
    setSettlementHistory(snapshots);
  };

  const handleJoinProject = async (name, code) => {
    setUsername(name);
    setAppError('');

    if (!hasBackendConfig) {
      const stored = loadLocalProjectState(code);
      if (!stored) {
        setAppError('项目码不存在，请确认后重试');
        return;
      }

      const existingMember = stored.members.find((member) => member.display_name === name);
      const nextMembers = existingMember ? stored.members : [...stored.members, createLocalMember(name)];
      const nextState = { ...stored, members: nextMembers };

      saveLocalProjectState(nextState);
      setProject(nextState.project);
      setActivePeriod(nextState.activePeriod);
      setMembers(nextState.members);
      setExpenses(nextState.expenses);
      setSettlementHistory(nextState.settlementHistory);
      setSettledNotice('');
      setScreen('home');
      return;
    }

    setIsBusy(true);
    try {
      const member = await joinProject({ code, displayName: name });
      await loadProjectState(member.project.id);
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
        defaultCurrency: created.currency,
        displayName: created.username,
        projectType: created.projectType,
        budgetAmount: created.budgetAmount,
      });
      await loadProjectState(createdProject.id);
      setScreen('home');
    } catch (error) {
      setAppError(error.message || '创建项目失败');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveExpense = async (draft) => {
    setAppError('');

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
        created_at: new Date().toISOString(),
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

  const handleAddMember = async (displayName) => {
    setAppError('');

    if (!hasBackendConfig) {
      const nextMembers = [...members, createLocalMember(displayName)];
      saveLocalProjectState({
        project: currentProject,
        activePeriod,
        members: nextMembers,
        expenses,
        settlementHistory,
      });
      setMembers(nextMembers);
      setMemberDialogOpen(false);
      return;
    }

    setIsBusy(true);
    try {
      const member = await addProjectMember({ projectId: currentProject.id, displayName });
      setMembers((items) => [...items, member]);
      setMemberDialogOpen(false);
    } catch (error) {
      setAppError(error.message || '添加成员失败');
    } finally {
      setIsBusy(false);
    }
  };

  const openDraftForConfirmation = async ({ sourceType, text = '', file }) => {
    setAppError('');
    setIsBusy(true);

    try {
      let parsedDraft = buildLocalDraft(sourceType, text);

      if (hasBackendConfig || sourceType === 'text') {
        try {
          const response = hasBackendConfig
            ? await createAiDraft({ projectId: currentProject.id, sourceType, text, file })
            : { draft: buildLocalDraft(sourceType, text) };
          parsedDraft = response.draft ?? parsedDraft;
        } catch {
          parsedDraft = buildLocalDraft(sourceType, text);
        }
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
        payerMemberId,
        participantMemberIds,
        exchangeRate: rate.rate,
        exchangeRateProvider: rate.provider,
        exchangeRateTimestamp: rate.timestamp,
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

  return (
    <div className="app-shell">
      <div className="phone">
        {screen === 'entry' && (
          <EntryScreen
            onCreateProject={(name) => {
              setUsername(name);
              setAppError('');
              setScreen('create');
            }}
            onJoinProject={handleJoinProject}
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
            onOpenAi={() => setAiOpen(true)}
            onOpenSettlement={() => setScreen('settlement')}
            onAddMember={() => {
              setAppError('');
              setMemberDialogOpen(true);
            }}
          />
        )}
        {screen === 'confirm' && draftExpense && (
          <ConfirmBill
            project={currentProject}
            members={members}
            draft={draftExpense}
            onBack={() => setScreen('home')}
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
            onOpenMembers={() => {
              setAppError('');
              setMemberDialogOpen(true);
            }}
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
            onClose={() => setMemberDialogOpen(false)}
            onSubmit={handleAddMember}
            appError={appError}
            isBusy={isBusy}
          />
        ) : null}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
