export function buildProjectInviteText({ projectName, code }) {
  const normalizedCode = String(code ?? '').trim().toUpperCase();
  const name = String(projectName ?? '').trim() || '共享账本';

  return [
    `我创建了「${name}」分账项目`,
    `项目码：${normalizedCode}`,
    '打开分账助手，输入项目码即可加入记账和结算。',
  ].join('\n');
}
