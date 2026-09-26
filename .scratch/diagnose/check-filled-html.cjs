/**
 * 校验填好的 HTML：
 * 1) 脚本语法、用例数量/ID、演示数据残留、转义（原有检查）
 * 2) 导出→导入 往返测试：buildFixedMarkdown() 生成报告，parseMarkdownFile() 解析回来逐字段比对
 * 3) 导入错误分支：文件名不合命名规则、内容不合导出格式、旧命名（YYYYMMDD_HHmm）被拒
 * 4) 命名规则：〈html同名〉_〈YYYYMMDD〉.md，时间戳精确到当天；取不到 html 文件名时回退测试主题
 * 5) 可选 argv[3]：真实模板 md（test template_20260926.md）按新规则可导入解析
 */
const fs = require('node:fs');

const html = fs.readFileSync(process.argv[2], 'utf8');
const templateMdPath = process.argv[3];
let failures = 0;
function check(ok, label) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures += 1;
}

// ---------- 1) 静态检查 ----------
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
check(scripts.length === 1, `script 块数 = 1（实际 ${scripts.length}）`);
let script = scripts[0];
for (const s of scripts) {
  try {
    new Function(s);
  } catch (error) {
    check(false, `脚本语法：${error.message}`);
  }
}

const ids = [...html.matchAll(/id: "(TC-\d+)"/g)].map((m) => m[1]);
check(ids.length === 28, `用例数 28（实际 ${ids.length}）`);
check(new Set(ids).size === ids.length, '用例 ID 无重复');
const titles = [...html.matchAll(/title: "([A-G]\d)\./g)].map((m) => m[1]);
check(titles.join(',') === 'A1,A2,A3,A4,B1,B2,B3,B4,B5,B6,B7,C1,C2,C3,C4,D1,D2,D3,D4,D5,D6,D7,E1,F1,F2,F3,G1,G2', `清单编号齐全（实际 ${titles.join(' ')}）`);
for (const bad of ['番茄时钟', '缪尔赛思', '阻断缺陷', '25分钟', 'UNIVERSAL_QA_MATRIX']) {
  check(!html.includes(bad), `演示残留 [${bad}] 已清除`);
}
check(html.includes('%APPDATA%\\\\OCTO'), 'APPDATA 转义（源码双反斜杠）');
check(html.includes('value="OCTO 仓库监控器 M3 人工验收"'), '主题已填');
check(html.includes('btnImportMarkdown') && html.includes('function parseMarkdownFile'), '导入功能已就位');
check(html.includes('btnRecentImports') && html.includes('recentImportsPanel') && html.includes('IDB_KEY_RECENT'), '最近导入记录功能已就位');
check(html.includes('〈同名〉_〈YYYYMMDD〉.md'), '导入命名规则文案为天级');
check(!html.includes('YYYYMMDD_HHmm'), '旧命名规则（YYYYMMDD_HHmm）已清除');
check(html.includes('test template_20260926.md'), '输出目标文件名默认预览为同名天级');

// ---------- 2) 执行页面脚本并做往返测试 ----------
const values = {
  testTopicInput: 'OCTO 仓库监控器 M3 人工验收',
  inspectorNameInput: '张三 (QA)',
  inspectionDateInput: '2026-09-27',
  selectEnv: 'Windows 11 × Chrome',
  overallRemarksText: '第一行综合备注\n第二行综合备注',
};
const documentStub = {
  getElementById: (id) => ({ value: values[id] ?? '' }),
};
const localStorageStub = { getItem: () => null, setItem: () => {} };
const windowStub = { addEventListener: () => {} };
const locationStub = { pathname: '/D:/study/tests/Manual%20Acceptance/test%20template.html' };

const buildApi = (location) => new Function(
  'localStorage', 'window', 'document', 'indexedDB', 'location',
  `${script}
  ;return {
    parseMarkdownReport, parseMarkdownFile, buildFixedMarkdown, DEFAULT_CASES,
    pruneRecentImports, formatRecentTime, normalizeDayStamp,
    getTargetFilename, getDocumentBaseName,
    setCases: (c) => { cases = c; },
    setVerdict: (v) => { currentVerdict = v; },
    getSessionTimestamp: () => sessionTimestamp,
  };`,
)(localStorageStub, windowStub, documentStub, undefined, location);
const api = buildApi(locationStub);

// 命名规则：html 同名 + 天级时间戳
check(/^\d{8}$/.test(api.getSessionTimestamp()), `时间戳精确到当天（${api.getSessionTimestamp()}）`);
check(api.getDocumentBaseName() === 'test template', `导出基名取 html 同名（${api.getDocumentBaseName()}）`);
check(api.normalizeDayStamp('20260926_2142') === '20260926', '旧值 YYYYMMDD_HHmm 归一为当天');
check(api.normalizeDayStamp('bad') === api.getSessionTimestamp(), '无日期旧值回退当天');

// 第一轮：默认用例 + CONDITIONAL + 多行备注
api.setCases(api.DEFAULT_CASES);
api.setVerdict('CONDITIONAL');
const md = api.buildFixedMarkdown();
const fileOk = `test template_${api.getSessionTimestamp()}.md`;
check(api.getTargetFilename() === fileOk, `导出文件名 = 〈html同名〉_〈YYYYMMDD〉.md（${api.getTargetFilename()}）`);
const parsed = api.parseMarkdownFile(fileOk, md);
check(parsed.topic === values.testTopicInput, `主题往返一致（${parsed.topic}）`);
check(parsed.date === values.inspectionDateInput, `日期往返一致（${parsed.date}）`);
check(parsed.env === values.selectEnv, `环境往返一致（${parsed.env}）`);
check(parsed.inspector === values.inspectorNameInput, `验收人往返一致（${parsed.inspector}）`);
check(parsed.remarks === values.overallRemarksText, '多行综合备注往返一致');
check(parsed.verdict === 'CONDITIONAL', `结论往返一致（${parsed.verdict}）`);
check(parsed.timestamp === api.getSessionTimestamp(), `归档时间戳往返一致（${parsed.timestamp}）`);
check(parsed.cases.length === api.DEFAULT_CASES.length, `用例数往返一致（${parsed.cases.length}）`);
api.DEFAULT_CASES.forEach((orig, i) => {
  const got = parsed.cases[i];
  const same = got && got.title === orig.title && got.criterion === orig.criterion
    && got.status === orig.status && got.note === (orig.note || '')
    && JSON.stringify(got.steps) === JSON.stringify(orig.steps);
  check(same, `用例 ${i + 1} [${orig.id}] 字段往返一致`);
});

// 第二轮：边界形状（多行备注、空判据、无步骤）+ REJECTED 结论
api.setCases([{
  id: 'TC-01', title: 'A1. 边界形状用例', criterion: '', status: 'FAIL',
  isExpanded: true, steps: [], note: '多行备注第一行\n多行备注第二行',
}]);
api.setVerdict('REJECTED');
const md2 = api.buildFixedMarkdown();
const parsed2 = api.parseMarkdownFile(`边界_20260926.md`, md2);
check(parsed2.verdict === 'REJECTED', '结论 REJECTED 解析正确');
check(parsed2.cases[0].criterion === '', '空判据（无明确标准说明）还原为空');
check(parsed2.cases[0].note === '多行备注第一行\n多行备注第二行', '多行实测备注往返一致');
check(Array.isArray(parsed2.cases[0].steps) && parsed2.cases[0].steps.length === 0, '无步骤还原为空数组');

// 第三轮：待测试结论往返（AI 先写清单，人工判定后再改结论）
api.setCases(api.DEFAULT_CASES);
api.setVerdict('PENDING');
const md3 = api.buildFixedMarkdown();
check(md3.includes('**⏳ 待测试 (PENDING)**'), '待测试结论可导出');
const parsed3 = api.parseMarkdownFile(`test template_20260927.md`, md3);
check(parsed3.verdict === 'PENDING', '待测试结论可导入往返');

// 回退：取不到 html 文件名时用测试主题命名
const apiNoLoc = buildApi(undefined);
check(apiNoLoc.getTargetFilename() === `OCTO 仓库监控器 M3 人工验收_${apiNoLoc.getSessionTimestamp()}.md`, `无 html 文件名回退主题（${apiNoLoc.getTargetFilename()}）`);

// ---------- 3) 错误分支 ----------
try {
  api.parseMarkdownFile('bad-name.md', md);
  check(false, '错误文件名应拒绝');
} catch (error) {
  check(error.message.includes('命名规则'), `错误文件名被拒：${error.message}`);
}
try {
  api.parseMarkdownFile('OCTO 仓库监控器 M3 人工验收_20260926_2142.md', md);
  check(false, '旧命名（YYYYMMDD_HHmm）应拒绝');
} catch (error) {
  check(error.message.includes('命名规则'), `旧命名被拒：${error.message}`);
}
try {
  api.parseMarkdownFile('x_20260926.md', '# 随便写的文档\n\n不是报告');
  check(false, '错误内容应拒绝');
} catch (error) {
  check(error.message.includes('不是本工具导出的格式'), `错误内容被拒：${error.message}`);
}

// ---------- 4) 最近导入记录：一周过期 / 倒序 / 上限 / 相对时间 ----------
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const rec = (name, agoMs) => ({ name, importedAt: new Date(now - agoMs).toISOString(), handle: null });
const pruned = api.pruneRecentImports([
  rec('a.md', 0.1 * day),
  rec('b.md', 6 * day),
  rec('c.md', 8 * day),
  rec('d.md', 30 * day),
  null,
  rec('e.md', 2 * day),
], now);
check(pruned.length === 3, `一周窗口只保留 3 条（实际 ${pruned.length}）`);
check(pruned.map(r => r.name).join(',') === 'a.md,e.md,b.md', `按导入时间倒序（实际 ${pruned.map(r => r.name).join(',')}）`);
const many = Array.from({ length: 12 }, (_, i) => rec(`f${i}.md`, i * 60 * 1000));
check(api.pruneRecentImports(many, now).length === 10, '最多保留 10 条');
check(api.formatRecentTime(new Date(now - 30 * 60 * 1000).toISOString()) === '30 分钟前', '相对时间：分钟');
check(api.formatRecentTime(new Date(now - 5 * 60 * 60 * 1000).toISOString()) === '5 小时前', '相对时间：小时');
check(api.formatRecentTime(new Date(now - 3 * day).toISOString()) === '3 天前', '相对时间：天');

// ---------- 5) 真实模板 md 按新规则可导入 ----------
if (templateMdPath) {
  const tplText = fs.readFileSync(templateMdPath, 'utf8');
  const tplName = templateMdPath.split(/[\\/]/).pop();
  const tpl = api.parseMarkdownFile(tplName, tplText);
  check(tpl.cases.length === 28, `模板 md 解析出 28 条用例（实际 ${tpl.cases.length}）`);
  check(tpl.timestamp === '20260926', `模板 md 归档时间戳为当天（${tpl.timestamp}）`);
  check(tpl.topic === 'OCTO 仓库监控器 M3 人工验收', `模板 md 主题可提取（${tpl.topic}）`);
  check(tpl.verdict !== null, `模板 md 结论可提取（${tpl.verdict}）`);
  check(tpl.cases.every((c) => Array.isArray(c.steps) && c.criterion !== undefined), '模板 md 用例字段齐全');
  const checklistText = tplText.replace('**阻断驳回重测 (Rejected)**', '**⏳ 待测试 (PENDING)**');
  const checklist = api.parseMarkdownFile('test template_20260927.md', checklistText);
  check(checklist.verdict === 'PENDING', '清单形态（待测试结论）可导入');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECKS FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
