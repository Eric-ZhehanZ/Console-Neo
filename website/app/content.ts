// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

export type Lang = "zh" | "en";
export type Localized = { zh: string; en: string };

const bi = (zh: string, en: string): Localized => ({ zh, en });

export const ui = {
  features: bi("功能", "Features"),
  guides: bi("指南", "Guides"),
  tagline: bi("模拟联合国会议控制台", "The meeting console for Model UN"),
  lede: bi(
    "主席在控制窗口操作，会场在投影窗口跟随，联席主席在各自设备上实时协作。",
    "The chair works in the controller, the room follows on the cast, and co-chairs collaborate live from their own devices.",
  ),
  platform: bi("macOS（Apple 芯片与 Intel）与 Windows · 公开测试版", "macOS (Apple silicon and Intel) and Windows · Beta"),
  controller: bi("控制窗口", "Controller"),
  cast: bi("投影窗口", "Cast"),
  search: bi("搜索指南", "Search guides"),
  noResults: bi("没有匹配的指南。", "No matching guide."),
  lineage: bi(
    "Console Neo 包含 Console Lite（© 2016 Liu Xiaoyi）与 Console Lite Edited（© 2018 Pan Ruizhe）的代码，依 MIT 许可使用。",
    "Console Neo includes code from Console Lite (© 2016 Liu Xiaoyi) and Console Lite Edited (© 2018 Pan Ruizhe), used under the MIT License.",
  ),
  source: bi("源代码", "Source"),
  freeSoftware: bi(
    "Console Neo 是自由软件，依 GNU AGPL v3 或更高版本授权，并附加署名与商标条款。",
    "Console Neo is free software under the GNU AGPL v3 or later, with additional attribution and trademark terms.",
  ),
  license: bi("许可证", "License"),
  notices: bi("声明", "Notices"),
  feedback: bi("反馈", "Feedback"),
  partnerships: bi("商务合作", "Partnerships"),
};

export type Feature = {
  id: string;
  title: Localized;
  body: Localized;
  controller: string;
  cast?: string;
};

export const features: Feature[] = [
  {
    id: "speakers",
    title: bi("发言名单", "Speakers’ lists"),
    body: bi(
      "撤销、开始/暂停、下一位，三个按钮。下一位带 700 毫秒冷却，空格键只切换开始与暂停。当前发言者与两个计时器同步显示在会场。",
      "Three controls: undo, start/pause, and next. Next has a 700 ms cooldown, and Space only starts or pauses. The current speaker and both timers follow on the cast.",
    ),
    controller: "controller-list",
    cast: "projector-list",
  },
  {
    id: "motions",
    title: bi("动议", "Motions"),
    body: bi(
      "记录 14 种动议，按提出时间或干扰程度排序。动议通过后选择“执行并前往”，直接创建并打开对应的发言名单、计时器或投票。",
      "Record 14 motion types, sorted by time or disruptiveness. On a passed motion, Execute & Go creates and opens its speakers’ list, timer, or vote.",
    ),
    controller: "controller-motions",
    cast: "projector-motions",
  },
  {
    id: "voting",
    title: bi("投票", "Voting"),
    body: bi(
      "逐席录入，支持多轮投票与不计弃权的三分之二门槛。每一票录入后立即显示在会场投影上。",
      "Record each delegation’s vote across rounds, with a two-thirds target that excludes abstentions. Each vote appears on the cast as it’s entered.",
    ),
    controller: "controller-vote",
    cast: "projector-vote",
  },
  {
    id: "collaboration",
    title: bi("协作", "Collaboration"),
    body: bi(
      "联席主席与查看者使用会话 ID 和验证码加入。同一局域网内直接连接，其他网络经中继连接。委员会数据保存在主持设备上。",
      "Co-chairs and viewers join with the Session ID and an Auth Code. Devices on the same network connect directly; others connect through the relay. Committee data stays on the host device.",
    ),
    controller: "controller-home",
  },
];

export type GuideSection = {
  title: Localized;
  intro?: Localized;
  items?: Localized[];
  caution?: boolean;
};

export type Guide = {
  id: string;
  title: Localized;
  summary: Localized;
  sections: GuideSection[];
};

export const guides: Guide[] = [
  {
    id: "start",
    title: bi("快速开始", "Quick start"),
    summary: bi("第一次主持会议。", "Run your first session."),
    sections: [
      {
        title: bi("概览", "Overview"),
        intro: bi(
          "Console Neo 有两个窗口：主席操作的控制窗口，以及面向会场的投影窗口。主持设备保存委员会数据，其他设备以主席或查看者身份加入。",
          "Console Neo has two windows: the controller, where the chair works, and the cast, which faces the room. The host device stores committee data, and other devices join as Chair or Viewer.",
        ),
      },
      {
        title: bi("第一次会议", "Your first session"),
        items: [
          bi("在启动页选择“在本地创建一个新会话...”。", "On the launch page, choose Create a Local Session..."),
          bi("选择“创建一个新委员会”并命名。在“进入现有委员会”中选中它，再选择“开始主持”。", "Choose Create a New Committee and name it. Select it under Resume a Committee, then choose Start Chairing."),
          bi("在“席位”中每行输入一个代表团，然后记录出席。", "In Seats, enter one delegation per line, then record attendance."),
          bi("点击底栏最右侧的投影图标打开投影窗口。投影关闭时，右键该图标可在当前屏幕以窗口模式打开。", "Click the rightmost cast icon in the bottom bar to open the cast. While it’s closed, right-click the icon to open it windowed on the current screen."),
          bi("记录一项动议，标记为“通过”，再选择“执行并前往”。", "Record a motion, mark it Passed, then choose Execute & Go."),
        ],
      },
      {
        title: bi("会前准备", "Before the session"),
        items: [
          bi("主持设备接通电源，并允许通知与声音。", "Keep the host plugged in, with notifications and sound allowed."),
          bi("将会场屏幕设为扩展显示。", "Set the room display to extend the desktop."),
          bi("复核席位、文件与委员会名称。", "Review the roster, documents, and committee name."),
          bi("导出一份数据归档（见“数据与备份”）。", "Export a data archive (see Data & backup)."),
        ],
      },
    ],
  },
  {
    id: "sessions",
    title: bi("会话与角色", "Sessions & roles"),
    summary: bi("主持、加入、验证码与权限。", "Hosting, joining, codes, and permissions."),
    sections: [
      {
        title: bi("主持会话", "Hosting"),
        items: [
          bi("主持设备运行会话并保存全部委员会。一个会话可包含多个委员会。", "The host runs the session and stores every committee. One session can hold several committees."),
          bi("选择“开始主持”进行修改，或选择“只读进入”浏览。", "Choose Start Chairing to make changes, or Enter Read-only to browse."),
          bi("会话使用端口 3066。", "The session uses port 3066."),
        ],
      },
      {
        title: bi("加入会话", "Joining"),
        items: [
          bi("选择“连接到会话...”，从“附近的会话”中选择，或输入会话 ID，然后输入 6 位验证码。", "Choose Connect to a Session..., pick from Nearby Sessions or enter the Session ID, then enter the 6-character code."),
          bi("“手动连接...”使用服务器地址与主席密码或只读密码。", "Connect Manually... takes a server address and the Chair or Reader password."),
        ],
      },
      {
        title: bi("验证码与角色", "Codes & roles"),
        items: [
          bi("会话 ID 与验证码显示在主持设备的委员会首页。切换“主席 · 查看”显示对应角色的验证码；点击验证码可显示或隐藏。", "The Session ID and Auth Code appear on the host’s committee home page. Switch Chair · Viewer to show each role’s code; click the code to show or hide it."),
          bi("主席可修改会议；查看者只读。", "Chairs can change the meeting; Viewers are read-only."),
          bi("验证码每 30 秒更新，密码每 10 分钟更新，仅用于新的连接。已加入的设备保持连接。", "Codes change every 30 seconds and passwords every 10 minutes, for new connections only. Joined devices stay connected."),
          bi("设置中的“断开所有连接并重置密码”会断开全部参与者。", "Disconnect Everyone & Reset Passwords in Settings disconnects every participant."),
        ],
        caution: true,
      },
      {
        title: bi("同步与本机设置", "Shared and per-device settings"),
        items: [
          bi("委员会名称与“投影主页文字”同步到所有设备。", "The committee name and Cast Homepage Text sync to every device."),
          bi("语言、连接路由、提醒与“非投影页面行为”保存在本机。", "Language, routing, reminders, and Non-castable Pages are per device."),
        ],
      },
    ],
  },
  {
    id: "meeting",
    title: bi("主持会议", "Running a meeting"),
    summary: bi("席位、动议、发言、文件与投票。", "Seats, motions, speakers, documents, and votes."),
    sections: [
      {
        title: bi("席位与门槛", "Seats & thresholds"),
        items: [
          bi("在“席位”中每行输入一个代表团，空行会被忽略。", "In Seats, enter one delegation per line. Blank lines are ignored."),
          bi("记录出席后，底栏显示简单多数、三分之二多数与五分之一数。", "Once attendance is recorded, the bottom bar shows Simple Majority, Two-Thirds, and One-Fifth."),
          bi("修改席位名单会重置全部出席状态。", "Editing the roster resets all attendance."),
        ],
        caution: true,
      },
      {
        title: bi("动议", "Motions"),
        items: [
          bi("选择动议类型、提出者与所需参数。", "Choose a motion type, a proposer, and its parameters."),
          bi("按提出时间或干扰程度排序，也可筛选。", "Sort by time or disruptiveness, and filter the list."),
          bi("结果可设为待定、通过、未通过或撤回；每项动议可单独控制是否投影。", "Set each outcome to Pending, Passed, Failed, or Withdrawn, and choose per motion whether it appears on the cast."),
          bi("动议通过后选择“执行并前往”，创建并打开对应的发言名单、计时器或投票；文件相关动议会打开所附的第一个文件。", "On a passed motion, Execute & Go creates and opens its speakers’ list, timer, or vote. A Document-Related motion opens its first attached document."),
        ],
      },
      {
        title: bi("发言名单", "Speakers’ lists"),
        items: [
          bi("创建名单时设置总时长（0 = 不限）与每名代表时长。", "Set the total time (0 = unlimited) and the time per delegate when creating a list."),
          bi("输入代表团名称时自动补全，拖动可调整顺序；“更多声音”优先推荐发言较少的代表团。", "Delegation names autocomplete as you type, and rows can be dragged to reorder. More Voices suggests delegations that have spoken less."),
          bi("撤销、开始/暂停、下一位。下一位有 700 毫秒冷却；空格键只切换开始与暂停。", "Undo, start/pause, and next. Next has a 700 ms cooldown; Space only starts or pauses."),
          bi("计时停止时，可修改当前与总剩余时间。", "While the timer is stopped, both the current and total remaining time can be edited."),
        ],
      },
      {
        title: bi("计时器与文件", "Timers & documents"),
        items: [
          bi("自由磋商、全体协商、自由辩论与暂停会议会创建独立计时器。提醒规则保存在本机。", "Unmoderated Caucus, Consultation of the Whole, Free Debate, and Pause Meeting create standalone timers. Reminder rules are per device."),
          bi("PDF 与图片可预览和投影，其他格式可保存。", "PDFs and images preview and cast; other formats can be saved."),
          bi("PDF 缩放范围为 50%–300%，缩放与滚动位置同步到投影。", "PDF zoom ranges from 50% to 300%, and zoom and scroll position sync to the cast."),
        ],
      },
      {
        title: bi("投票", "Voting"),
        items: [
          bi("新投票默认使用“不计弃权三分之二”。取消勾选后可填写固定目标（0 = 未定），或按当前出席填入简单多数或三分之二。", "New votes default to two-thirds excluding abstentions. Uncheck it to set a fixed target (0 = undecided), or fill in a simple majority or two-thirds from current attendance."),
          bi("轮数为 0 表示不限轮次。", "Set rounds to 0 for unlimited rounds."),
          bi("创建投票时锁定当前出席的席位。", "A vote locks in the seats present when it’s created."),
          bi("进入下一轮时保留已投的票；自动录入只询问“过 / 未投票”的席位。", "Later rounds keep existing votes; automatic entry asks only the seats still at Pass / No Vote."),
          bi("每轮结束后显示“过/未投”计数。计划轮次结束后，仍可确认追加一轮。", "The Pass/NV count appears when a round ends. After the planned rounds, an extra round can be confirmed."),
        ],
      },
      {
        title: bi("会后", "After the session"),
        items: [
          bi("在“数据”中复核发言时长、动议、投票与各代表团的参与情况。", "Review speaking time, motions, votes, and each delegation’s participation in Data."),
          bi("导出数据归档。", "Export a data archive."),
        ],
      },
    ],
  },
  {
    id: "collaboration",
    title: bi("协作与投影", "Collaboration & casting"),
    summary: bi("多设备、连接路由与同步投影。", "Multiple devices, routing, and synced projection."),
    sections: [
      {
        title: bi("多位主席", "Working together"),
        items: [
          bi("主席可修改会议、编辑协作笔记并主持同步投影；查看者可浏览会议并打开本机投影。", "Chairs can change the meeting, edit collaborative notes, and host the synced cast. Viewers can browse the meeting and open their own cast."),
          bi("所有修改实时同步到每台设备。两位主席同时编辑同一发言名单时会自动合并。", "Every change syncs live to every device. Simultaneous edits to one speakers’ list merge automatically."),
          bi("开会前分工：谁负责动议结果、计时、投票与删除操作。", "Agree beforehand who handles motion outcomes, timers, votes, and deletions."),
        ],
      },
      {
        title: bi("连接路由", "Routing"),
        items: [
          bi("默认“优先局域网，中继备用”。在隔离的场地网络中选择“始终使用中继”，也可填写自定义中继地址。", "The default is LAN first, relay as backup. On an isolated venue network, choose Always use the relay, or enter a custom relay URL."),
          bi("中继只转发会话流量，委员会数据保存在主持设备上。", "The relay only forwards session traffic; committee data stays on the host."),
        ],
      },
      {
        title: bi("连接中断", "Dropped connections"),
        items: [
          bi("远程连接中断时，控制窗口显示“连接已断开，正在重连…”。修改需在连接恢复后进行。", "When a remote connection drops, the controller shows a reconnecting banner. Make changes once the banner clears."),
          bi("重连后自动同步中断期间的变化。局域网 30 秒、中继 90 秒内未恢复时返回启动页。", "On reconnect, everything that changed meanwhile syncs in. If the link isn’t back within 30 seconds on a LAN or 90 seconds on the relay, the app returns to the launch page."),
        ],
      },
      {
        title: bi("同步投影", "Synced projection"),
        items: [
          bi("底栏最右侧的图标打开或关闭本机投影窗口。", "The rightmost icon in the bottom bar opens or closes this device’s cast."),
          bi("相邻的图标申请或释放同步投影主持；右键它可跳到当前投影的页面。", "The icon next to it claims or releases the synced cast. Right-click it to jump to the page being cast."),
          bi("开启“同步投影”后，其他设备的投影窗口跟随主持者。其他主席可确认接管。", "With Synced Projection on, every other device’s cast follows the host. Another Chair can confirm a takeover."),
          bi("本机主持同步投影时，“非投影页面行为”决定切到不可投影页面时显示基础页还是保持上次投影。", "While this device hosts the synced cast, Non-castable Pages decides whether leaving for a non-castable page shows the base page or keeps the last cast."),
          bi("同步关闭时，各设备手动独立投影。", "With sync off, each device casts on its own."),
        ],
      },
    ],
  },
  {
    id: "reference",
    title: bi("参考", "Reference"),
    summary: bi("动议类型、笔记与快捷键。", "Motion types, notes, and shortcuts."),
    sections: [
      {
        title: bi("动议类型", "Motion types"),
        items: [
          bi("有主持核心磋商 → 发言名单。", "Moderated Caucus → speakers’ list."),
          bi("自由磋商、全体协商、自由辩论、暂停会议 → 独立计时器。", "Unmoderated Caucus, Consultation of the Whole, Free Debate, Pause Meeting → standalone timer."),
          bi("延长上一磋商 → 按最近执行的磋商或轮流发言再创建一次，时长可修改。", "Prolong Last Caucus → repeats the most recently executed caucus or tour, with editable durations."),
          bi("轮流发言 → 由当前出席席位组成的发言名单。", "Tour de Table → speakers’ list of the seats present."),
          bi("文件相关 → 打开所附文件。", "Document-Related → opens the attached document."),
          bi("程序性投票 → 简单多数；实质性投票 → 不计弃权三分之二。", "Procedural Vote → simple majority. Substantive Vote → two-thirds excluding abstentions."),
          bi("开启辩论、休会、闭会、其他动议 → 记录结果。", "Open Debate, Suspend Meeting, Adjourn Meeting, Other → outcome recorded."),
        ],
      },
      {
        title: bi("笔记", "Notes"),
        items: [
          bi("主席可为动议、计时器、文件、投票、发言名单与单次发言添加协作笔记，支持 Markdown 快捷输入。", "Chairs can attach collaborative notes to motions, timers, documents, votes, speakers’ lists, and individual speeches, with Markdown shortcuts."),
          bi("每个委员会最多 300 条笔记，每条最多 5,000 字符。", "Each committee holds up to 300 notes of up to 5,000 characters."),
          bi("删除对象时，其笔记一并删除。", "Deleting an item deletes its notes."),
        ],
      },
      {
        title: bi("数据页", "Data"),
        items: [
          bi("汇总会议与各代表团的发言、动议与投票；独立计时器不计入发言时长。", "Summarizes speeches, motions, and votes for the meeting and each delegation. Standalone timers don’t count toward speaking time."),
          bi("代表团表格最多可按三列组合排序。", "The delegation table sorts by up to three columns."),
        ],
      },
      {
        title: bi("快捷键", "Keyboard shortcuts"),
        items: [
          bi("⌘/Ctrl + 1…9：委员会、席位、动议、发言名单、计时器、文件、投票、数据、设置。", "⌘/Ctrl + 1…9: Committee, Seats, Motions, Speakers’ Lists, Timers, Documents, Voting, Data, Settings."),
          bi("⌘/Ctrl + \\：聚焦控制窗口。⌘/Ctrl + Shift + |：打开或聚焦投影窗口。", "⌘/Ctrl + \\: focus the controller. ⌘/Ctrl + Shift + |: open or focus the cast."),
          bi("发言名单：A 或 ← 上一位，D 或 → 下一位，S 或 ↓ 暂停，空格开始/暂停。", "Speakers’ lists: A or ← previous, D or → next, S or ↓ pause, Space start/pause."),
          bi("开始投票时按住 Alt 进入手动录入。", "Hold Alt when starting a vote to enter votes manually."),
          bi("Esc 关闭对话框；⌘/Ctrl + Enter 提交。", "Esc closes a dialog; ⌘/Ctrl + Enter submits."),
        ],
      },
    ],
  },
  {
    id: "data",
    title: bi("数据与备份", "Data & backup"),
    summary: bi("存储、导出与导入。", "Storage, export, and import."),
    sections: [
      {
        title: bi("存储", "Storage"),
        intro: bi(
          "委员会、文件与笔记保存在主持设备上 Console Neo 的用户数据目录中。完全重启应用后回到启动页，选择委员会即可继续。",
          "Committees, documents, and notes live in Console Neo’s user-data folder on the host. After a full restart the app opens on the launch page; select the committee to continue.",
        ),
      },
      {
        title: bi("导出", "Export"),
        items: [
          bi("完全退出并重新启动应用，在创建本地会话之前打开菜单“Edit → Import or Export Data”。", "Fully quit and relaunch the app. Before creating a local session, open Edit → Import or Export Data."),
          bi("将归档保存到安全位置。重要会议前后各保留一份，并在另一处存放副本。", "Save the archive somewhere safe. Keep one from before and after each major session, with a copy on separate storage."),
        ],
      },
      {
        title: bi("导入", "Import"),
        items: [
          bi("导入会替换本机的全部数据，包括每个委员会、文件与笔记。", "Import replaces all data on this device, including every committee, document, and note."),
          bi("导入前先导出当前数据。导入后逐一检查委员会与文件。", "Export current data first. After importing, check each committee and document."),
        ],
        caution: true,
      },
    ],
  },
  {
    id: "troubleshooting",
    title: bi("问题排查", "Troubleshooting"),
    summary: bi("连接、投影、文件与投票。", "Connections, casting, documents, and votes."),
    sections: [
      {
        title: bi("连接", "Connecting"),
        items: [
          bi("附近的会话为空：确认两台设备在同一局域网。启动页提示需要网络时，点击“连接到会话...”重新检测。", "Nearby Sessions is empty: check both devices are on the same network. If the launch page asks for a network, click Connect to a Session... to check again."),
          bi("验证码无效：验证码每 30 秒更新，请使用主持设备上当前显示的验证码。", "Code rejected: codes change every 30 seconds. Use the one currently shown on the host."),
          bi("局域网不可用：在设置中选择“始终使用中继”。", "The LAN is unavailable: choose Always use the relay in Settings."),
          bi("无法主持：同一设备上已有另一个实例在使用端口 3066，关闭它后重试。", "Hosting fails: another instance on this device is using port 3066. Close it and try again."),
        ],
      },
      {
        title: bi("投影", "Casting"),
        items: [
          bi("投影窗口不见了：点击底栏最右侧的图标，或按 ⌘/Ctrl + Shift + |。", "The cast is missing: click the rightmost bottom-bar icon or press ⌘/Ctrl + Shift + |."),
          bi("投影不跟随：确认“同步投影”已开启，并查看当前的投影主持者。", "The cast isn’t following: check Synced Projection is on and see who hosts the cast."),
        ],
      },
      {
        title: bi("计时、文件与投票", "Timers, documents & votes"),
        items: [
          bi("没有提醒声音：检查系统通知与声音权限，以及本机的提醒规则。", "No reminder sound: check the system notification and sound permissions, and this device’s reminder rules."),
          bi("文件无法预览：可预览 PDF 与图片。在详情页替换文件时需使用相同类型。", "A document won’t preview: PDFs and images preview. Replacing a file from its page requires the same file type."),
          bi("投票席位不对：席位在创建投票时锁定，请重新创建投票。", "A vote has the wrong seats: seats lock when a vote is created. Create the vote again."),
        ],
      },
    ],
  },
];
