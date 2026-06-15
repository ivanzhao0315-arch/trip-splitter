import React, { useMemo, useState } from 'react';
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
import './styles.css';

const initialMembers = [
  { id: 'm1', name: '小陈', initials: '陈', color: '#d6e0f3' },
  { id: 'm2', name: '张三', initials: '张', color: '#e1e3e4' },
  { id: 'm3', name: 'Ivan', initials: 'I', color: '#22c55e' },
];

const initialExpenses = [
  { id: 'e1', title: '晚餐', amount: 400, payer: '小陈', participants: 3, time: '今天 19:30', category: 'restaurant' },
  { id: 'e2', title: '打车', amount: 86.5, payer: '张三', participants: 2, time: '今天 15:10', category: 'commute' },
  { id: 'e3', title: '民宿房费', amount: 1200, payer: 'Ivan', participants: 3, time: '昨天 14:00', category: 'hotel' },
];

const currencies = [
  { code: 'CNY', label: 'CNY - 人民币 (¥)' },
  { code: 'USD', label: 'USD - 美元 ($)' },
  { code: 'JPY', label: 'JPY - 日元 (¥)' },
  { code: 'EUR', label: 'EUR - 欧元 (€)' },
  { code: 'HKD', label: 'HKD - 港币 ($)' },
];

function money(value, currency = 'CNY') {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'JPY' ? '¥' : '¥';
  return `${symbol}${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

function createProjectCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function Avatar({ member, size = 'md' }) {
  return (
    <div className={`avatar avatar-${size}`} style={{ backgroundColor: member.color }}>
      {member.initials}
    </div>
  );
}

function TopBar({ title, code, onBack }) {
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
        <button className="code-pill" aria-label="复制项目码">
          <span>#{code}</span>
          <Copy size={15} />
        </button>
      ) : null}
    </header>
  );
}

function EntryScreen({ onCreateProject, onJoinProject }) {
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
        </section>

        <section className="entry-actions">
          <button
            className="primary-button"
            onClick={() => {
              if (requireName()) onCreateProject(name.trim());
            }}
          >
            <Plus size={22} weight="fill" />
            创建新项目
          </button>

          <div className="divider"><span>或者</span></div>

          <div className="join-row">
            <div className="text-field">
              <Tag size={21} />
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeCode(event.target.value))}
                maxLength={4}
                placeholder="4位项目码"
                className="code-input"
              />
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                if (requireName() && joinCode.length === 4) onJoinProject(name.trim(), joinCode);
              }}
            >
              加入
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function CreateProjectScreen({ username, onBack, onCreated }) {
  const [projectName, setProjectName] = useState('');
  const [currency, setCurrency] = useState('CNY');
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
            <span>结算币种</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {currencies.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </label>

          <div className="info-card">
            <Sparkle size={20} />
            <p>创建后将生成 4 位项目码。任何知道项目码的人都可以加入并共同记录支出。</p>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </section>

        <button
          className="primary-button"
          onClick={() => {
            if (!projectName.trim()) {
              setError('请输入项目名称');
              return;
            }
            onCreated({ name: projectName.trim(), currency, code, username });
          }}
        >
          立即创建
        </button>
      </main>
    </div>
  );
}

function ProjectHome({ project, members, expenses, onOpenAi, onOpenSettlement }) {
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="screen">
      <TopBar title={project.name} code={project.code} />
      <main className="content with-nav">
        <section className="summary-grid">
          <article className="total-card">
            <p>总计支出 ({project.currency})</p>
            <h2>{money(total, project.currency)}</h2>
          </article>
          <article className="mini-card">
            <p>我的余额</p>
            <strong className="positive">+¥120.00</strong>
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
            <button>管理成员</button>
          </div>
          <div className="member-strip">
            {members.map((member) => (
              <div className="member-chip" key={member.id}>
                <Avatar member={member} />
                <span>{member.name}</span>
              </div>
            ))}
            <button className="add-member">
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
            {expenses.map((expense) => (
              <article className="expense-row" key={expense.id}>
                <div className="expense-icon"><Receipt size={22} /></div>
                <div className="expense-copy">
                  <h4>{expense.title}</h4>
                  <p>{expense.payer}支付 · {expense.participants}人平分</p>
                </div>
                <div className="expense-amount">
                  <strong>{money(expense.amount, project.currency)}</strong>
                  <span>{expense.time}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <button className="ai-fab" onClick={onOpenAi}>
        <Sparkle size={22} weight="fill" />
        AI 记账
      </button>
      <BottomNav active="details" />
    </div>
  );
}

function AiSheet({ onClose, onConfirm }) {
  const options = [
    { icon: <Camera size={24} />, title: '拍摄收据', desc: '拍照并识别纸质账单明细' },
    { icon: <Image size={24} />, title: '上传截图', desc: '微信/支付宝支付详情页截图' },
    { icon: <ClipboardText size={24} />, title: '粘贴文字', desc: '粘贴群聊记录或账单文本' },
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
          {options.map((option) => (
            <button className="sheet-option" key={option.title} onClick={onConfirm}>
              <div>{option.icon}</div>
              <span>
                <strong>{option.title}</strong>
                <small>{option.desc}</small>
              </span>
              <CaretRight size={20} />
            </button>
          ))}
        </div>
        <button className="cancel-button" onClick={onClose}>取消</button>
      </section>
    </div>
  );
}

function ConfirmBill({ project, members, onBack, onSave }) {
  const [rate, setRate] = useState(7.25);
  const converted = 40 * rate;

  return (
    <div className="screen">
      <TopBar title="确认账单" code={project.code} onBack={onBack} />
      <main className="content confirm-content">
        <section className="amount-card">
          <label>金额</label>
          <h2><span>$</span>40.00</h2>
          <p>USD（美元）</p>
        </section>

        <section className="fx-card">
          <div>
            <p><ArrowsLeftRight size={17} /> 汇率 1 USD = {rate.toFixed(2)} {project.currency}</p>
            <strong>折合 {money(converted, project.currency)}</strong>
          </div>
          <button onClick={() => setRate((current) => Number((current + 0.01).toFixed(2)))}>刷新汇率</button>
        </section>

        <section className="form-stack">
          <PickerRow label="付款人" value="小陈" member={members[0]} />
          <div className="field-group">
            <label>参与人（3人）</label>
            <div className="participant-box">
              {members.map((member) => (
                <button className="participant active" key={member.id}>{member.name}<CheckCircle size={15} weight="fill" /></button>
              ))}
              <button className="circle-add"><Plus size={16} /></button>
            </div>
          </div>
          <label className="form-field">
            <span>描述</span>
            <input defaultValue="Starbucks Coffee" />
          </label>
        </section>
      </main>
      <div className="bottom-actions">
        <button className="primary-button" onClick={() => onSave({ converted })}>保存账单</button>
        <button className="text-button">手动修改</button>
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

function SettlementScreen({ project, onBack, onSettled, settled }) {
  const transfers = [
    { from: '张三', to: '小陈', amount: 96 },
    { from: 'Ivan', to: '小陈', amount: 74 },
  ];

  return (
    <div className="screen">
      <TopBar title="结算汇总" code={project.code} onBack={onBack} />
      <main className="content with-nav settlement-content">
        <section className="period-card">
          <div>
            <span>当前周期</span>
            <strong><CalendarBlank size={20} />2026-06</strong>
          </div>
          <button>切换周期 <CaretDown size={17} /></button>
        </section>

        <section className="balance-card">
          <h3>净支出状态</h3>
          {[
            { name: '小陈（你）', amount: '+¥170.00', type: '待收', positive: true },
            { name: '张三', amount: '-¥96.00', type: '应付' },
            { name: 'Ivan', amount: '-¥74.00', type: '应付' },
          ].map((item) => (
            <div className="balance-row" key={item.name}>
              <span className="avatar avatar-sm">{item.name[0]}</span>
              <strong>{item.name}</strong>
              <div>
                <b className={item.positive ? 'positive' : 'negative'}>{item.amount}</b>
                <small>{item.type}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="transfer-card">
          <div className="transfer-title">
            <h3>最佳结算方案</h3>
            <Sparkle size={20} weight="fill" />
          </div>
          {transfers.map((transfer) => (
            <article className="transfer-row" key={transfer.from}>
              <span>{transfer.from}</span>
              <ArrowsLeftRight size={18} />
              <span>{transfer.to}</span>
              <strong>{money(transfer.amount, project.currency)}</strong>
            </article>
          ))}
        </section>

        <section className="section-block">
          <div className="section-header">
            <h3>历史结算</h3>
            <button>查看全部</button>
          </div>
          {[
            { title: '2026年05月结算', meta: '3人参与 · 2笔转账', amount: 450, date: '2026-06-01' },
            { title: '2026年04月结算', meta: '3人参与 · 1笔转账', amount: 1230.5, date: '2026-05-01' },
          ].map((item) => (
            <article className="history-row" key={item.title}>
              <CheckCircle size={25} />
              <div>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
              <div>
                <strong>{money(item.amount, project.currency)}</strong>
                <span>{item.date}</span>
              </div>
            </article>
          ))}
        </section>
      </main>
      <div className="bottom-actions nav-offset">
        <button className={`primary-button ${settled ? 'settled' : ''}`} onClick={onSettled}>
          <CheckCircle size={22} weight="fill" />
          {settled ? '结算成功' : '标记为已结算'}
        </button>
      </div>
      {settled ? <div className="toast">周期 2026-06 已归档至历史结算</div> : null}
      <BottomNav active="stats" />
    </div>
  );
}

function BottomNav({ active }) {
  const items = [
    { id: 'details', label: '明细', icon: <Receipt size={22} /> },
    { id: 'stats', label: '统计', icon: <ChartBar size={22} /> },
    { id: 'members', label: '成员', icon: <UsersThree size={22} /> },
    { id: 'settings', label: '设置', icon: <GearSix size={22} /> },
  ];
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button className={active === item.id ? 'active' : ''} key={item.id}>
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function App() {
  const [screen, setScreen] = useState('entry');
  const [username, setUsername] = useState('');
  const [project, setProject] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const [expenses, setExpenses] = useState(initialExpenses);
  const members = useMemo(() => initialMembers, []);

  const currentProject = project || { name: '杭州周末游', code: 'A7K2', currency: 'CNY' };

  return (
    <div className="app-shell">
      <div className="phone">
        {screen === 'entry' && (
          <EntryScreen
            onCreateProject={(name) => {
              setUsername(name);
              setScreen('create');
            }}
            onJoinProject={(name, code) => {
              setUsername(name);
              setProject({ name: '杭州周末游', code, currency: 'CNY' });
              setScreen('home');
            }}
          />
        )}
        {screen === 'create' && (
          <CreateProjectScreen
            username={username}
            onBack={() => setScreen('entry')}
            onCreated={(created) => {
              setProject({ name: created.name, code: created.code, currency: created.currency });
              setScreen('home');
            }}
          />
        )}
        {screen === 'home' && (
          <ProjectHome
            project={currentProject}
            members={members}
            expenses={expenses}
            onOpenAi={() => setAiOpen(true)}
            onOpenSettlement={() => setScreen('settlement')}
          />
        )}
        {screen === 'confirm' && (
          <ConfirmBill
            project={currentProject}
            members={members}
            onBack={() => setScreen('home')}
            onSave={({ converted }) => {
              setExpenses((items) => [
                { id: `e${items.length + 1}`, title: 'Starbucks Coffee', amount: converted, payer: '小陈', participants: 3, time: '刚刚', category: 'coffee' },
                ...items,
              ]);
              setScreen('home');
            }}
          />
        )}
        {screen === 'settlement' && (
          <SettlementScreen
            project={currentProject}
            onBack={() => setScreen('home')}
            onSettled={() => setSettled(true)}
            settled={settled}
          />
        )}
        {aiOpen ? (
          <AiSheet
            onClose={() => setAiOpen(false)}
            onConfirm={() => {
              setAiOpen(false);
              setScreen('confirm');
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
