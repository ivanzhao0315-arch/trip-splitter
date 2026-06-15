export function buildProjectInviteText({ projectName, code, appUrl }) {
  const normalizedCode = String(code ?? '').trim().toUpperCase();
  const name = String(projectName ?? '').trim() || '共享账本';
  const normalizedAppUrl = String(appUrl ?? '').trim();

  const lines = [
    `我创建了「${name}」分账项目`,
    `项目码：${normalizedCode}`,
  ];

  if (normalizedAppUrl) {
    lines.push(`加入链接：${normalizedAppUrl}`);
  }

  lines.push(normalizedAppUrl
    ? '打开链接后输入昵称即可加入记账和结算。'
    : '打开分账助手，输入项目码即可加入记账和结算。');

  return lines.join('\n');
}
