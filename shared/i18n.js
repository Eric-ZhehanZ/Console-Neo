const Vue = require('vue');

/* Full UI dictionary. Keys are stable slugs; values per language. */
const DICT = {
  // Generic
  submit: { zh: '提交', en: 'Submit' },
  confirm: { zh: '确定', en: 'Confirm' },
  create: { zh: '创建', en: 'Create' },
  add: { zh: '添加', en: 'Add' },
  edit: { zh: '编辑', en: 'Edit' },
  save: { zh: '保存', en: 'Save' },
  reset: { zh: '重置', en: 'Reset' },
  apply: { zh: '应用', en: 'Apply' },
  back: { zh: '返回', en: 'Back' },
  del: { zh: '删除', en: 'Delete' },
  pause: { zh: '暂停', en: 'Pause' },
  start: { zh: '开始', en: 'Start' },
  copied: { zh: '已复制', en: 'Copied' },
  search: { zh: '搜索', en: 'Search' },
  noSearchResults: { zh: '无搜索结果', en: 'No results' },
  displayName: { zh: '显示名', en: 'Display Name' },
  time: { zh: '时间', en: 'Time' },

  // Quorum bar
  simpleMajority: { zh: '简单多数', en: 'Simple Majority' },
  twoThirds: { zh: '三分之二多数', en: 'Two-Thirds' },
  oneFifth: { zh: '五分之一数', en: 'One-Fifth' },

  // Startup / picker
  createConf: { zh: '创建一个新委员会', en: 'Create a New Committee' },
  connectToSession: { zh: '连接到会话...', en: 'Connect to a Session...' },
  createLocalSession: { zh: '在本地创建一个新会话...', en: 'Create a Local Session...' },
  loading: { zh: '加载中...', en: 'Loading...' },
  createCommittee: { zh: '创建委员会', en: 'Create Committee' },
  committeeName: { zh: '委员会名', en: 'Committee Name' },
  connectTo: { zh: '连接到...', en: 'Connect to...' },
  serverUrl: { zh: '服务器URL', en: 'Server URL' },
  password: { zh: '密码', en: 'Password' },
  connect: { zh: '连接', en: 'Connect' },
  nearbyInstances: { zh: '附近的会话', en: 'Nearby Sessions' },
  manualConnect: { zh: '手动连接...', en: 'Connect Manually...' },
  enterCode: { zh: '输入 6 位连接码', en: 'Enter the 6-character code' },
  noNearby: { zh: '正在搜索附近的会话...', en: 'Searching for nearby sessions...' },
  connectCode: { zh: '连接码', en: 'Code' },
  roleChair: { zh: '主席', en: 'Chair' },
  roleReader: { zh: '只读', en: 'Reader' },
  suggestedDelegates: { zh: '更多声音', en: 'More Voices' },
  sortChrono: { zh: '按时间排序', en: 'Chronological order' },
  sortDisruptive: { zh: '最具颠覆性优先', en: 'Most disruptive first' },
  filterPending: { zh: '仅显示待决动议', en: 'Pending motions only' },
  filterCustom: { zh: '显示全部（自定义可见性）', en: 'All motions (custom visibility)' },
  filterActive: { zh: '仅显示进行中', en: 'Active only' },
  totalSpeeches: { zh: '发言总次数', en: 'Total Speeches' },
  avgSpeech: { zh: '平均发言时长', en: 'Avg Speech' },
  participation: { zh: '出席代表发言率', en: 'Participation' },
  delegatePage: { zh: '代表详情', en: 'Delegate page' },
  theirMotions: { zh: '提出的动议', en: 'Motions Proposed' },
  speechHistory: { zh: '发言记录', en: 'Speech History' },
  timeline: { zh: '活动时间线', en: 'Timeline' },
  noRecords: { zh: '暂无记录', en: 'No records yet' },
  speakingTime: { zh: '发言时长', en: 'Speaking Time' },
  speechesShort: { zh: '发言次数', en: 'Speeches' },
  motionsShort: { zh: '动议数', en: 'Motions' },
  openNote: { zh: '笔记', en: 'Notes' },
  notePlaceholder: { zh: '记录笔记，支持 Markdown 快捷输入，与其他主席实时同步…',
    en: 'Take notes - markdown shortcuts supported, synced live with other chairs\u2026' },
  noteSaveFailed: { zh: '保存失败（可能超出长度限制）', en: 'Save failed (length limit?)' },
  noteOffline: { zh: '连接已断开，正在重连…', en: 'Disconnected - reconnecting\u2026' },
  connLost: { zh: '连接已断开，正在重连… 恢复前无法保存修改',
    en: "Connection lost - reconnecting\u2026 Changes can't be saved until it's back" },
  connGaveUp: { zh: '无法重新连接到会话，将返回启动页。',
    en: "Couldn't reconnect to the session. Returning to the launch page." },
  noteMotionTitle: { zh: '{who}的动议笔记：{name}', en: "Notes on {who}'s Motion: {name}" },
  noteSeatTitle: { zh: '{who}的发言笔记：{name}', en: "Notes on {who}'s Presentation: {name}" },
  noteEntityTitle: { zh: '笔记：{name}', en: 'Notes: {name}' },
  relatedNotes: { zh: '相关笔记', en: 'Related Notes' },
  noteMentions: { zh: '提及', en: 'mentions' },
  moreDelegates: { zh: '还有 {n} 位', en: '{n} more' },
  motionsPassed: { zh: '动议通过', en: 'Passed' },
  passRate: { zh: '通过率', en: 'Pass Rate' },
  historyTruncated: { zh: '仅显示最近 {n} 条记录', en: 'Showing the latest {n} entries' },
  language: { zh: '语言', en: 'Language' },
  connection: { zh: '连接', en: 'Connection' },
  backToLaunch: { zh: '返回启动页', en: 'Back to Launch Page' },
  resumeExisting: { zh: '进入现有委员会', en: 'Resume a Committee' },
  existingCommittees: { zh: '现有委员会', en: 'Existing Committees' },
  noCommittees: { zh: '暂无委员会', en: 'No committees yet' },
  startChairing: { zh: '开始主持', en: 'Start Chairing' },
  readOnlyMode: { zh: '只读进入', en: 'Enter Read-only' },
  readerPassword: { zh: '只读密码', en: 'Reader PW' },
  chairPassword: { zh: '主席密码', en: 'Chair PW' },
  resetKeys: { zh: '断开所有连接并重置密码', en: 'Disconnect Everyone & Reset Passwords' },
  resetKeysConfirm: { zh: '将断开所有已连接的客户端并重新生成两个密码，确定吗？',
    en: 'This disconnects every client and regenerates both passwords. Continue?' },
  errWrongPassword: { zh: '密码错误，无法连接。', en: 'Wrong password - connection refused.' },
  clickToReveal: { zh: '点击显示', en: 'Click to reveal' },
  clickToCopy: { zh: '再次点击复制整行', en: 'Click again to copy the line' },
  castSync: { zh: '同步投影', en: 'Synced Projection' },
  castSyncOn: { zh: '与其他控制台同步投影内容', en: 'Sync cast content with other consoles' },
  castSyncOff: { zh: '本控制台独立投影', en: 'Independent projection for this console' },
  castIdleTitle: { zh: '非投影页面行为', en: 'Non-castable Pages' },
  castFallbackBase: { zh: '显示基础空白页（委员会名与人数）',
    en: 'Cast the base page (committee name & counts)' },
  castFallbackKeep: { zh: '保持上次投影内容，直到打开新的可投影页面',
    en: 'Keep the last cast until a new castable page opens' },
  castOnDevice: { zh: '在本设备开启投影', en: 'Start projection on this device' },
  castOffDevice: { zh: '在本设备关闭投影', en: 'Stop projection on this device' },
  reminderPlay: { zh: '播放提醒音', en: 'Play reminder sounds' },
  reminderMute: { zh: '不播放提醒音', en: "Don't play reminder sounds" },
  reminderSingle: { zh: '每次发言最多提醒一次', en: 'At most one reminder per speech' },
  remBefore: { zh: '结束前', en: 'Before end' },
  remEnd: { zh: '结束时', en: 'At end' },
  remTimes: { zh: '次数', en: 'Times' },
  castSyncHint: { zh: '开启时，投影按钮用于主持同步投影：单击开始或停止跟随本机页面，右键跳转到正在投影的页面。关闭后各设备独立投影。',
    en: 'When on, the cast switch hosts the concurrent cast: click to start or stop following'
      + ' the pages of this device; right-click jumps to the page being cast.'
      + ' When off, every device casts independently.' },
  castHostOff: { zh: '停止跟随本机投影', en: 'Stop hosting the cast' },
  castHostOn: { zh: '主持同步投影（跟随本机页面）', en: 'Host the cast (follow this device)' },
  castCoHost: { zh: '他人正在主持投影，点击接管', en: 'Someone else is hosting - click to take over' },
  castTakeoverConfirm: { zh: '正在主持同步投影。接管后投影将改为跟随本设备，继续？',
    en: 'is hosting the concurrent cast. Take over so it follows this device instead?' },
  switchCommittee: { zh: '切换委员会', en: 'Switch Committee' },
  connectOtherServer: { zh: '连接其他服务器', en: 'Connect to Another Server' },
  connectOtherConfirm: {
    zh: '将断开当前连接并返回启动页，确定继续?',
    en: 'This disconnects the current session and returns to the launch page. Continue?',
  },

  // Tabs / titles
  committee: { zh: '委员会', en: 'Committee' },
  seats: { zh: '席位', en: 'Seats' },
  debate: { zh: '发言名单', en: 'Speakers’ Lists' },
  motions: { zh: '动议', en: 'Motions' },
  timers: { zh: '计时器', en: 'Timers' },
  files: { zh: '文件', en: 'Documents' },
  votes: { zh: '投票', en: 'Voting' },
  data: { zh: '数据', en: 'Data' },
  settings: { zh: '设置', en: 'Settings' },
  rollcall: { zh: '点名', en: 'Roll Call' },

  // Home
  activeLists: { zh: '活跃发言名单', en: 'Active Speakers’ Lists' },
  activeTimers: { zh: '活跃计时器', en: 'Active Timers' },
  activeVotes: { zh: '活跃投票', en: 'Active Votes' },
  noActiveLists: { zh: '无活跃发言名单', en: 'No active speakers’ lists' },
  noActiveTimers: { zh: '无活跃计时器', en: 'No active timers' },
  noActiveVotes: { zh: '无活跃投票', en: 'No active votes' },

  // Seats
  editSeatList: { zh: '编辑席位列表', en: 'Edit Seat List' },
  seatListEmpty: { zh: '席位列表为空', en: 'Seat list is empty' },
  clickEditSeats: { zh: '请点击编辑添加席位', en: 'Tap Edit to add seats' },
  seatEditHintLine: { zh: '请每行填入一个席位名，空行将在提交时被忽略。',
    en: 'One seat name per line; blank lines are ignored on submit.' },
  seatEditResetHint: { zh: '编辑过后，所有出席状态将被重置。',
    en: 'After editing, all attendance status is reset.' },
  seatEditListHint: { zh: '编辑席位列表不会影响已填写的发言列表。',
    en: 'Editing seats does not affect existing speakers’ lists.' },
  seatListLabel: { zh: '席位列表', en: 'Seat List' },
  sortByPinyin: { zh: '根据拼音排序', en: 'Sort by Pinyin' },

  // Lists
  createList: { zh: '创建发言名单', en: 'Create Speakers’ List' },
  clickAddList: { zh: '请点击添加创建发言名单', en: 'Tap Add to create a speakers’ list' },
  noLists: { zh: '无发言名单', en: 'No speakers’ lists' },
  totalTime: { zh: '总时长', en: 'Total Time' },
  totalTimeUnlimited: { zh: '总时长 ( 0 = 不限 )', en: 'Total Time ( 0 = unlimited )' },
  perDelegate: { zh: '每名代表', en: 'Per Delegate' },
  currentRemaining: { zh: '当前剩余时间', en: 'Remaining Time' },
  undoStep: { zh: '撤销上一步', en: 'Undo last step' },
  revealCode: { zh: '显示验证码', en: 'Show code' },
  chairCode: { zh: '主席码', en: 'Chair Code' },
  viewerCode: { zh: '查看码', en: 'Viewer Code' },
  sessionIdLabel: { zh: '会话 ID', en: 'Session ID' },
  authCode: { zh: '验证码', en: 'Auth Code' },
  roleViewer: { zh: '查看', en: 'Viewer' },
  hideCode: { zh: '隐藏验证码', en: 'Hide code' },
  needNetworkForCollab: { zh: '协作需要局域网或互联网连接',
    en: 'Local Network or Internet Connection Needed for Collaboration' },
  lanLabel: { zh: '局域网', en: 'Local Network' },
  relayLabel: { zh: '中继', en: 'Relay' },
  netUp: { zh: '可用', en: 'available' },
  netDown: { zh: '不可用', en: 'unavailable' },
  netChecking: { zh: '检查中', en: 'checking' },
  sessionRow: { zh: '会话', en: 'Session' },
  checkNetwork: { zh: '检查网络', en: 'Check Network' },
  sessionIdHint: { zh: '输入主持屏幕上显示的会话 ID',
    en: 'Enter the session ID shown on the host screen' },
  errNoSession: { zh: '未找到该会话：请确认 ID 正确且主持端在线',
    en: 'Session not found - check the ID and that the host is online' },
  errRelay: { zh: '无法连接中继服务器', en: 'Could not reach the relay server' },
  routingTitle: { zh: '连接路由', en: 'Connection Routing' },
  routeLanFirst: { zh: '优先局域网，中继备用', en: 'LAN first, relay as backup' },
  routeRelayAlways: { zh: '始终使用中继', en: 'Always use the relay' },
  relayServer: { zh: '中继服务器', en: 'Relay Server' },
  relayConnected: { zh: '中继已连接，可跨网络加入本会话',
    en: 'Relay connected - this session is reachable across networks' },
  relayOffline: { zh: '中继不可用，当前仅限局域网连接', en: 'Relay unreachable - LAN connections only for now' },
  editDuration: { zh: '修改时长', en: 'Edit Duration' },
  spotsLeft: { zh: '余位', en: 'Spots Left' },
  prevSpeaker: { zh: '上一位', en: 'Previous' },
  nextSpeaker: { zh: '下一位', en: 'Next' },
  moveUp: { zh: '上移', en: 'Move Up' },
  moveDown: { zh: '下移', en: 'Move Down' },
  deleteListConfirm: { zh: '确定删除发言名单', en: 'Delete speakers’ list' },
  listTimersDeleted: { zh: '其计时器将一并删除。', en: 'Its timers will be deleted too.' },

  // Timers
  createTimer: { zh: '创建计时器', en: 'Create Timer' },
  editTimer: { zh: '修改计时器', en: 'Edit Timer' },
  clickAddTimer: { zh: '请点击添加创建计时器', en: 'Tap Add to create a timer' },
  noTimers: { zh: '无计时器', en: 'No timers' },
  deleteTimerConfirm: { zh: '确定删除计时器', en: 'Delete timer' },

  // Files
  clickDropFiles: { zh: '请拖拽文件至此窗口以添加文件, PDF以及图片文件可以直接预览',
    en: 'Drag files here to add them; PDFs and images preview directly' },
  noFiles: { zh: '无文件', en: 'No documents' },
  dropToUpload: { zh: '拖放以上传', en: 'Drop to upload' },
  dropToUpdate: { zh: '拖放以更新', en: 'Drop to update' },
  uploadFile: { zh: '上传文件', en: 'Upload File' },
  deleteFileConfirm: { zh: '确定删除文件', en: 'Delete document' },
  zoom: { zh: '缩放', en: 'Zoom' },

  // Votes
  addVote: { zh: '添加投票', en: 'Add Vote' },
  clickAddVote: { zh: '请点击添加创建投票', en: 'Tap Add to create a vote' },
  noVotes: { zh: '无投票', en: 'No votes' },
  voteSeatsNote: {
    zh: '注: 参与投票的席位为提交时出席的席位，在添加投票后无法更改。',
    en: 'Note: participating seats are those present at submission and '
      + 'cannot be changed afterward.',
  },
  rounds: { zh: '轮数 ( 0 = 不限 )', en: 'Rounds ( 0 = unlimited )' },
  useSubstantiveTwoThirds: { zh: '使用不计弃权三分之二多数', en: 'Use two-thirds excluding abstentions' },
  substantiveShort: { zh: '不计弃权三分之二', en: '2/3 excl. abstentions' },
  target: { zh: '目标', en: 'Target' },
  targetUndecided: { zh: '目标 ( 0 = 未定 )', en: 'Target ( 0 = undecided )' },
  targetTwoThirds: { zh: '目标 - 不计弃权 2/3', en: 'Target - 2/3 excl. abstentions' },
  setToHalf: { zh: '设为简单半数', en: 'Set to Simple Majority' },
  setToTwoThirds: { zh: '设为三分之二', en: 'Set to Two-Thirds' },
  favor: { zh: '赞成', en: 'For' },
  against: { zh: '反对', en: 'Against' },
  abstain: { zh: '弃权', en: 'Abstain' },
  passOrNoVote: { zh: '过 / 未投票', en: 'Pass / No Vote' },
  passOrNoVoteShort: { zh: '过/未投', en: 'Pass/NV' },
  total: { zh: '总计', en: 'Total' },
  notStarted: { zh: '未启动', en: 'Not Started' },
  roundCurrentFmt: { zh: '第 {n} 轮', en: 'Round {n}' },
  roundOfFmt: { zh: '共 {n} 轮', en: 'of {n}' },
  startRoundManualFmt: { zh: '手动进行第 {n} 轮', en: 'Manually Start Round {n}' },
  startRoundFmt: { zh: '开始第 {n} 轮', en: 'Start Round {n}' },
  endRoundFmt: { zh: '结束第 {n} 轮', en: 'End Round {n}' },

  // Motions
  addMotion: { zh: '录入动议', en: 'New Motion' },
  editMotion: { zh: '编辑动议', en: 'Edit Motion' },
  clickAddMotion: { zh: '请点击添加录入动议', en: 'Tap Add to record a motion' },
  noMotions: { zh: '无动议', en: 'No motions' },
  motionType: { zh: '动议类型', en: 'Motion Type' },
  proposer: { zh: '提出者', en: 'Proposer' },
  topic: { zh: '议题', en: 'Topic' },
  titleOrContent: { zh: '标题 / 内容', en: 'Title / Content' },
  comment: { zh: '备注', en: 'Comment' },
  associatedFiles: { zh: '关联文件', en: 'Associated Documents' },
  multiSelect: { zh: '可多选', en: 'multi-select' },
  noFilesUploadFirst: {
    zh: '暂无文件, 请先在文件页上传',
    en: 'No documents; upload on the Documents page first',
  },
  outcomePending: { zh: '待定', en: 'Pending' },
  outcomePassed: { zh: '通过', en: 'Passed' },
  outcomeFailed: { zh: '未通过', en: 'Failed' },
  outcomeWithdrawn: { zh: '撤回', en: 'Withdrawn' },
  proposedDraft: { zh: '拟议', en: 'Draft' },
  showInCast: { zh: '在投影中显示', en: 'Show in cast' },
  hideFromCast: { zh: '从投影中隐藏', en: 'Hide from cast' },
  executeAndGo: { zh: '执行并前往', en: 'Execute & Go' },
  executeAgain: { zh: '再次执行', en: 'Execute Again' },
  deleteMotionConfirm: { zh: '确定删除动议', en: 'Delete motion' },
  deleteVoteConfirm: { zh: '确定删除投票 (记录一并删除)', en: 'Delete vote (records included)' },
  confirmSpotsFull: { zh: '剩余总时间无法容纳添加的代表，是否继续?',
    en: 'Remaining total time cannot fit another delegate. Continue?' },
  confirmStartOverTime: { zh: '剩余时间已不足此名代表发言, 是否继续?',
    en: 'Not enough time left for this delegate. Continue?' },
  confirmRoundsDone: { zh: '按照预定轮数，投票已经结束，是否开始下一轮?',
    en: 'All planned rounds are done. Start another round?' },
  confirmAllVoted: { zh: '现在所有席位都已经完成投票，是否开始下一轮?',
    en: 'All seats have voted. Start another round?' },
  confirmLastRoundEnd: { zh: '这是最后一轮投票了，还有投票为过的席位，是否结束这轮投票?',
    en: 'This is the last round and some seats have not voted. End this round?' },
  confirmExitAuto: { zh: '确认退出自动模式?', en: 'Exit automatic mode?' },
  confirmLastRoundPass: { zh: '这是最后一轮投票了，是否将投票结果设置为过?',
    en: 'This is the last round. Set this vote to pass?' },
  proposerPosition: { zh: '提出者发言位置', en: 'Proposer’s Speaking Position' },
  proposerPositionAsk: { zh: '选择在何处发言?', en: 'chooses to speak where?' },
  speakFirst: { zh: '首位发言', en: 'Speak First' },
  speakLast: { zh: '末位发言', en: 'Speak Last' },
  proposerSkip: { zh: '暂不加入名单', en: 'Do Not Add Yet' },
  prolongPre: { zh: '将延长：', en: 'Will prolong: ' },
  prolongFilled: { zh: '，时长设置已按原磋商预填。',
    en: '; durations prefilled from the original caucus.' },
  prolongNone: { zh: '未找到已执行的磋商，将按普通时长动议处理。',
    en: 'No executed caucus found; treated as a plain timed motion.' },
  proposedAt: { zh: '提议时间', en: 'Proposed' },

  // Motion type labels
  mtMod: { zh: '有主持核心磋商', en: 'Moderated Caucus' },
  mtUnmod: { zh: '自由磋商', en: 'Unmoderated Caucus' },
  mtProlong: { zh: '延长上一磋商', en: 'Prolong Last Caucus' },
  mtCow: { zh: '全体协商', en: 'Consultation of the Whole' },
  mtTour: { zh: '轮流发言', en: 'Tour de Table' },
  mtDoc: { zh: '文件相关', en: 'Document-Related' },
  mtPvote: { zh: '程序性投票', en: 'Procedural Vote' },
  mtSvote: { zh: '实质性投票', en: 'Substantive Vote' },
  mtPause: { zh: '暂停会议', en: 'Pause Meeting' },
  mtSuspend: { zh: '休会', en: 'Suspend Meeting' },
  mtAdjourn: { zh: '闭会', en: 'Adjourn Meeting' },
  mtOpen: { zh: '开启辩论', en: 'Open Debate' },
  mtFree: { zh: '自由辩论', en: 'Free Debate' },
  mtOther: { zh: '其他动议', en: 'Other' },

  // Data / stats
  statistics: { zh: '统计', en: 'Statistics' },
  totalSpokenTime: { zh: '总发言时长', en: 'Total Speaking Time' },
  totalMotions: { zh: '动议总数', en: 'Total Motions' },
  passedMotions: { zh: '已通过动议', en: 'Passed Motions' },
  failedMotions: { zh: '未通过动议', en: 'Failed Motions' },
  voteRoundsSuffix: { zh: '轮', en: ' rounds' },
  presentSeats: { zh: '出席席位', en: 'Present Seats' },
  brandTextTitle: { zh: '投影主页文字', en: 'Cast Homepage Text' },
  brandTextHint: { zh: '留空则显示 Console Neo', en: 'Leave blank to show Console Neo' },
  history: { zh: '历史记录', en: 'History' },
  noHistory: { zh: '暂无历史记录', en: 'No history yet' },
  delegateData: { zh: '代表数据', en: 'Delegate Data' },
  delegate: { zh: '代表', en: 'Delegate' },
  attendance: { zh: '出席', en: 'Present' },
  speechCount: { zh: '发言次数', en: 'Speeches' },
  speechDuration: { zh: '发言时长', en: 'Speaking Time' },
  removed: { zh: '已移除', en: 'removed' },

  // Cast controls
  castThisPage: { zh: '投影此页 (右键前往投影中的页面)', en: 'Cast this page (right-click: go to casting page)' },
  endCastThisPage: { zh: '结束投影此页', en: 'Stop casting this page' },
  castSwitch: { zh: '投影开关 (右键彻底关闭投影)', en: 'Cast switch (right-click: close projector)' },

  // Settings page
  committeeTitle: { zh: '委员会名称', en: 'Committee Name' },
  reminderSound: { zh: '发言提醒音', en: 'Speaker Reminder Sound' },
  reminderRuleHint: { zh: '当总时长超过下值（秒）时，在剩余下值（秒）时提醒',
    en: 'When total time exceeds the first value (s), alert at the second value (s) remaining' },
  reminderAbove: { zh: '总时长超过 (秒)', en: 'Total over (s)' },
  reminderAt: { zh: '剩余 (秒) 时', en: 'At remaining (s)' },
  addRule: { zh: '添加规则', en: 'Add Rule' },
  langChinese: { zh: '中文', en: '中文' },
  langEnglish: { zh: 'English', en: 'English' },

  // Dynamic fragments
  perPersonSuffix: { zh: '/人', en: '/delegate' },
  prolongNamePrefix: { zh: '延长：', en: 'Prolong: ' },

  // Error toasts
  errAdd: { zh: '添加失败!', en: 'Failed to add!' },
  errUpdate: { zh: '更新失败!', en: 'Failed to update!' },
  errModify: { zh: '修改失败!', en: 'Failed to modify!' },
  errDelete: { zh: '删除失败!', en: 'Failed to delete!' },
  errOp: { zh: '操作失败!', en: 'Operation failed!' },
  errRename: { zh: '重命名失败!', en: 'Failed to rename!' },
  errSet: { zh: '设置失败!', en: 'Failed to set!' },
  errExecute: { zh: '执行失败!', en: 'Execution failed!' },
  errGetFile: { zh: '获取文件失败', en: 'Failed to fetch document' },
  errLoad: { zh: '加载失败!', en: 'Failed to load!' },
  errReadFile: { zh: '读取文件失败!', en: 'Failed to read file!' },
  errConnect: { zh: '连接失败!', en: 'Connection failed!' },
  errCreate: { zh: '创建失败', en: 'Failed to create' },
  errNoProlong: { zh: '未找到可延长的磋商', en: 'No caucus available to prolong' },
  errNoBaseFile: { zh: '未找到关联文件', en: 'Associated document not found' },
  oneFileOnly: { zh: '请每次只上传一个文件', en: 'Please upload one file at a time' },
  sameTypeOnly: { zh: '请上传同样类型的文件: ', en: 'Please upload a file of the same type: ' },
  saveFile: { zh: '保存文件', en: 'Save Document' },
  saveFailed: { zh: '保存失败', en: 'Save failed' },
  saveSuccess: { zh: '保存成功!', en: 'Saved!' },
  savedTo: { zh: '保存到 ', en: 'Saved to ' },
  openFile: { zh: '打开文件', en: 'Open File' },
  ok: { zh: '好的', en: 'OK' },
  startFailed: { zh: '启动失败! 请检查是否已经启动另一个 Console Neo 实例。',
    en: 'Failed to start! Check whether another Console Neo instance is already running.' },
  startFailedWin: { zh: '同时，请确认您的 Console Neo 是使用管理员权限运行的。',
    en: 'Also make sure Console Neo is running with administrator privileges.' },
  notifyTimerEnd: { zh: '计时结束', en: 'Timer ended' },
  notifyNewFile: { zh: '新文件', en: 'New document' },
  notifyFileUpdate: { zh: '文件更新', en: 'Document updated' },
};

function makeStore() {
  let saved = 'zh';
  try {
    saved = window.localStorage.getItem('cln-lang') || 'zh';
  } catch(e) { }

  return new Vue({
    data: {
      lang: saved === 'en' ? 'en' : 'zh',
    },
  });
}

const store = makeStore();

function setLang(lang) {
  store.lang = lang === 'en' ? 'en' : 'zh';
  try {
    window.localStorage.setItem('cln-lang', store.lang);
  } catch(e) { }
}

function t(key) {
  const entry = DICT[key];
  if(!entry) return key;
  return entry[store.lang] || entry.zh;
}

// Global mixin: templates use {{ t('key') }} and re-render when lang changes.
// Reading store.lang inside the method makes each render watcher track it.
Vue.mixin({
  methods: {
    t(key) {
      const active = store.lang; // establish reactive dependency
      const entry = DICT[key];
      if(!entry) return key;
      return entry[active] || entry.zh;
    },

    /* Formatted lookup: tf('roundCurrentFmt', { n: 2 }) */
    tf(key, params) {
      let out = this.t(key);
      for(const k of Object.keys(params || {})) out = out.replace(`{${k}}`, params[k]);
      return out;
    },
  },
});

module.exports = { DICT, store, setLang, t };
