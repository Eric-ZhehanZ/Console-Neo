// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

export type Lang = "zh" | "en";
export type Localized = { zh: string; en: string };

const bi = (zh: string, en: string): Localized => ({ zh, en });

import { VERSION } from "./release";

export { REPO, RELEASE_PAGE, VERSION } from "./release";

// Links go through the Worker, which picks GitHub or a mirror by the visitor's country
export const downloads = {
  mac: {
    href: "/download/mac",
    label: bi("下载 macOS 版", "Download for macOS"),
    detail: bi("Apple 芯片与 Intel", "Apple silicon and Intel"),
  },
  win: {
    href: "/download/win",
    label: bi("下载 Windows 版", "Download for Windows"),
    detail: bi("64 位", "64-bit"),
  },
};

export const ui = {
  features: bi("功能", "Features"),
  guides: bi("指南", "Guides"),
  source: bi("源代码", "Source"),
  tagline: bi("模联主席团的会议控制台", "The console for Model UN chairs"),
  lede: bi(
    "由模联人打造，为模联人服务。简洁的界面，完整的会议流程，还有联席主席之间的实时协作。",
    "Built by MUNers, for MUNers. A clean interface, the whole committee flow, and real-time collaboration between co-chairs.",
  ),
  runNote: bi("无需安装，下载解压后双击 Console Neo 即可运行。", "No installation needed. Unzip after downloading, then double-click Console Neo to run."),
  openSource: bi("自由开源", "Free and Open Source"),
  version: bi(`版本 ${VERSION}`, `Version ${VERSION}`),
  controller: bi("控制窗口", "Controller"),
  cast: bi("会场屏幕", "Room screen"),
  moreTitle: bi("主席台需要的，都在这里", "Everything else a dais needs"),
  search: bi("搜索指南", "Search guides"),
  noResults: bi("没有匹配的指南。", "No matching guide."),
  freeSoftware: bi(
    "Console Neo 是自由软件，依 GNU AGPL v3 或更高版本授权，并附加署名与商标条款。",
    "Console Neo is free software under the GNU AGPL v3 or later, with additional attribution and trademark terms.",
  ),
  commercial: bi(
    "如需将 Console Neo 用于商业再分发，或在商业环境中使用，建议事先告知并联系",
    "Planning to redistribute Console Neo commercially, or to use it in a commercial setting? Please let us know in advance at",
  ),
  lineage: bi(
    "Console Neo 包含 Console Lite（© 2016 Liu Xiaoyi）与 Console Lite Edited（© 2018 Pan Ruizhe）的代码，依 MIT 许可使用。",
    "Console Neo includes code from Console Lite (© 2016 Liu Xiaoyi) and Console Lite Edited (© 2018 Pan Ruizhe), used under the MIT License.",
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
    id: "collaboration",
    title: bi("主席团，实时协作", "Chair together, in real time"),
    body: bi(
      "Console Neo 是首个为主席团本地协作打造的会议控制台。联席主席用自己的电脑加入，动议、发言与投票即时同步到每一块屏幕。会议室的局域网就能直接连接，其他网络经中继加入，委员会数据始终保存在主持电脑上。",
      "Console Neo is the first chair console built for local-first collaboration. Co-chairs join from their own laptops, and every motion, speaker, and vote syncs to every screen instantly. The room's Wi-Fi is all it takes, the relay covers everything else, and your committee's data lives on the host laptop.",
    ),
    controller: "controller-home",
  },
  {
    id: "speakers",
    title: bi("发言名单，跟得上会场节奏", "Speakers' lists that keep up"),
    body: bi(
      "代表举牌，名字随打随补全。撤销、开始、下一位，一次点击或一个按键就能完成；会场屏幕上，谁在发言、还剩多久，一目了然。",
      "Add delegations as fast as placards go up, with names completing as you type. Undo, start, and next are one click or one key away, and the room always sees who's speaking and how much time is left.",
    ),
    controller: "controller-list",
    cast: "projector-list",
  },
  {
    id: "motions",
    title: bi("动议，自动排好序", "Motions, already in order"),
    body: bi(
      "动议提出时随手记录，Console Neo 按干扰程度自动排序。表决通过后一键执行，直接打开对应的磋商、计时或投票。",
      "Log motions as they're raised and Console Neo orders them by disruptiveness. Once one passes, a single click opens its caucus, timer, or vote.",
    ),
    controller: "controller-motions",
    cast: "projector-motions",
  },
  {
    id: "voting",
    title: bi("投票，全场看得见", "Votes the whole room can follow"),
    body: bi(
      "逐个代表团唱票，门槛自动计算。每一票都实时出现在会场屏幕上，结果清清楚楚。",
      "Call the roll delegation by delegation while Console Neo works out the thresholds. Every vote lands on the room screen the moment you enter it.",
    ),
    controller: "controller-vote",
    cast: "projector-vote",
  },
];

export const extras: { icon: string; label: Localized }[] = [
  { icon: "event_seat", label: bi("点名与法定人数", "Roll call and quorum") },
  { icon: "timer", label: bi("磋商与会议计时", "Caucus timers") },
  { icon: "folder", label: bi("文件投影", "Documents on screen") },
  { icon: "cast", label: bi("独立的会场屏幕", "A dedicated room screen") },
  { icon: "equalizer", label: bi("代表团发言数据", "Delegate statistics") },
  { icon: "comment", label: bi("主席团协作笔记", "Shared chair notes") },
  { icon: "wifi", label: bi("局域网即可协作", "Works on the room's Wi-Fi") },
  { icon: "translate", label: bi("中英双语界面", "Chinese and English") },
];

/* Guides. Inline tokens render as the app's own controls:
     [icon:name]      a Material icon, as in the app's toolbars
     [fab:name]       a round action button (bottom right of a page)
     [btn:label|icon] a menu row from the launch page
     [key:K]          a keyboard key
   A step's `shot` names a screenshot in public/guides/<shot>-<lang>.webp */

export type Step = { text: Localized; shot?: string };

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
  steps?: Step[];
  sections?: GuideSection[];
};

export const guides: Guide[] = [
  {
    id: "start",
    title: bi("开始第一次会议", "Start your first session"),
    summary: bi("创建委员会，录入席位，开始主持。", "Create a committee, add seats, start chairing."),
    steps: [
      {
        text: bi("打开 Console Neo，选择 [btn:在本地创建一个新会话...|wifi_tethering]。这台电脑就是主持电脑，委员会数据保存在这里。",
          "Open Console Neo and choose [btn:Create a Local Session...|wifi_tethering]. This laptop becomes the host, and your committee's data is stored here."),
        shot: "launch",
      },
      {
        text: bi("选择“创建一个新委员会”并命名，再选择“进入现有委员会”。",
          "Choose Create a New Committee and give it a name, then choose Resume a Committee."),
        shot: "picker",
      },
      {
        text: bi("选中委员会，点击 [fab:gavel] 开始主持。只想查看时点击 [fab:visibility]，以只读方式进入。",
          "Select your committee and click [fab:gavel] to start chairing. To look around without changing anything, click [fab:visibility] instead."),
        shot: "picker-browse",
      },
      {
        text: bi("打开 [icon:event_seat] 席位页，点击 [fab:edit]，每行输入一个代表团，然后提交。",
          "Open [icon:event_seat] Seats, click [fab:edit], enter one delegation per line, and submit."),
        shot: "seats-edit",
      },
      {
        text: bi("逐个记录出席。底栏实时显示出席人数，以及简单多数、三分之二多数与五分之一数。",
          "Mark attendance. The bottom bar keeps the count of present delegations, plus Simple Majority, Two-Thirds, and One-Fifth, up to date."),
        shot: "seats",
      },
    ],
  },
  {
    id: "invite",
    title: bi("邀请联席主席", "Invite your co-chairs"),
    summary: bi("用会话 ID 和验证码加入同一场会议。", "Join the same session with a Session ID and code."),
    steps: [
      {
        text: bi("在主持电脑的 [icon:home] 委员会首页，右下角显示会话 ID 与验证码。点击验证码可显示或隐藏；切换“主席 · 查看”获取对应角色的验证码。",
          "On the host's [icon:home] committee home, the Session ID and Auth Code sit in the bottom right. Click the code to show or hide it, and switch Chair · Viewer for each role's code."),
        shot: "home",
      },
      {
        text: bi("在联席主席的电脑上打开 Console Neo，选择 [btn:连接到会话...|settings_ethernet]，输入会话 ID 后点击 [btn:连接|cloud]。同一局域网内的会话也会直接列在这里。",
          "On your co-chair's laptop, open Console Neo, choose [btn:Connect to a Session...|settings_ethernet], enter the Session ID, and click [btn:Connect|cloud]. Sessions on the same network are listed here too."),
        shot: "join-connect",
      },
      {
        text: bi("输入 6 位验证码，点击 [btn:连接|keyboard_arrow_right]。验证码每 30 秒更新一次，已加入的设备保持连接。",
          "Enter the 6-character code and click [btn:Connect|keyboard_arrow_right]. Codes refresh every 30 seconds; devices that have joined stay connected."),
        shot: "join-code",
      },
    ],
  },
  {
    id: "speakers",
    title: bi("主持发言名单", "Run a speakers' list"),
    summary: bi("创建名单，添加代表团，掌控计时。", "Create a list, add speakers, run the clock."),
    steps: [
      {
        text: bi("在 [icon:record_voice_over] 发言名单页点击 [fab:add]，填写名称、总时长（0 为不限）与每名代表时长。",
          "In [icon:record_voice_over] Speakers' Lists, click [fab:add] and set a name, the total time (0 for unlimited), and the time per delegate."),
        shot: "list-create",
      },
      {
        text: bi("打开名单，点击“添加”输入代表团，名称随打随补全；拖动可以调整顺序。",
          "Open the list and click Add to enter delegations; names complete as you type, and you can drag rows to reorder them."),
        shot: "list",
      },
      {
        text: bi("[fab:play_arrow] 开始或暂停，[fab:skip_next] 请下一位代表，[fab:undo] 撤销上一步。键盘同样可用：[key:Space] 开始或暂停，[key:D] 或 [key:→] 下一位，[key:A] 或 [key:←] 上一位。",
          "[fab:play_arrow] starts or pauses, [fab:skip_next] calls the next speaker, and [fab:undo] undoes the last step. The keyboard works too: [key:Space] starts or pauses, [key:D] or [key:→] goes to the next speaker, [key:A] or [key:←] goes back."),
      },
      {
        text: bi("会场屏幕同步显示当前发言者、下一位代表与两个计时器。",
          "The room screen shows the current speaker, who's next, and both timers."),
        shot: "cast-list",
      },
    ],
  },
  {
    id: "motions",
    title: bi("处理动议", "Handle motions"),
    summary: bi("记录、排序、表决、一键执行。", "Record, sort, decide, and execute."),
    steps: [
      {
        text: bi("在 [icon:gavel] 动议页点击 [fab:add]，选择动议类型和提出者，填写所需参数。",
          "In [icon:gavel] Motions, click [fab:add], choose the motion type and proposer, and fill in its details."),
        shot: "motion-add",
      },
      {
        text: bi("点击 [icon:schedule] 按提出时间排序，切换为 [icon:whatshot] 则按干扰程度排序；[icon:filter_list] 筛选动议。为每项动议选择待定、通过、未通过或撤回，[icon:visibility] 控制它是否出现在会场屏幕上。",
          "Click [icon:schedule] to sort by time, or switch to [icon:whatshot] to sort by disruptiveness; [icon:filter_list] filters the list. Mark each motion Pending, Passed, Failed, or Withdrawn; [icon:visibility] decides whether it appears on the room screen."),
        shot: "motions",
      },
      {
        text: bi("动议通过后，点击行内的执行按钮，例如磋商的 [icon:record_voice_over]、计时的 [icon:timer] 或投票的 [icon:thumbs_up_down]，直接创建并打开对应页面。",
          "Once a motion passes, click its execute button, such as [icon:record_voice_over] for a caucus, [icon:timer] for a timer, or [icon:thumbs_up_down] for a vote, to create and open it in one step."),
        shot: "cast-motions",
      },
    ],
  },
  {
    id: "voting",
    title: bi("组织投票", "Run a vote"),
    summary: bi("创建投票，逐席录入，全场同步。", "Create a vote and record it seat by seat."),
    steps: [
      {
        text: bi("在 [icon:thumbs_up_down] 投票页点击 [fab:add]。默认使用“不计弃权三分之二”；创建时锁定当前出席的席位。",
          "In [icon:thumbs_up_down] Voting, click [fab:add]. New votes use two-thirds excluding abstentions, and lock in the seats present right now."),
        shot: "vote-create",
      },
      {
        text: bi("打开投票，点击 [fab:play_arrow] 开始一轮，逐个代表团录入；开始时按住 [key:Alt] 可改为手动录入。点击 [fab:done] 结束本轮。",
          "Open the vote and click [fab:play_arrow] to start a round, then record each delegation in turn; hold [key:Alt] as you start to enter votes manually. Click [fab:done] to close the round."),
        shot: "vote",
      },
      {
        text: bi("每一票都实时显示在会场屏幕上，本轮结束后显示完整结果。",
          "Every vote shows on the room screen as you enter it, with the full tally when the round ends."),
        shot: "cast-vote",
      },
    ],
  },
  {
    id: "casting",
    title: bi("投影到会场", "Put it on the room screen"),
    summary: bi("打开会场屏幕，让它跟随你的页面。", "Open the room screen and have it follow you."),
    steps: [
      {
        text: bi("点击底栏最右侧的 [icon:cast]，会场屏幕会出现在第二块显示器上。投影关闭时右键该图标，可在当前屏幕以窗口方式预览。",
          "Click [icon:cast] at the far right of the bottom bar and the room screen opens on your second display. While it's closed, right-click the icon to preview it in a window on your own screen."),
      },
      {
        text: bi("点击相邻的 [icon:pause_presentation] 成为投影主持，图标变为 [icon:present_to_all]。此后会场屏幕跟随你打开的页面，其他主席的会场屏幕也一同跟随。",
          "Click [icon:pause_presentation] next to it to host the cast; it turns into [icon:present_to_all]. The room screen now follows whichever page you open, and so do your co-chairs' room screens."),
      },
      {
        text: bi("右键 [icon:present_to_all] 可随时跳回正在投影的页面。",
          "Right-click [icon:present_to_all] to jump back to the page being shown."),
        shot: "cast-motions",
      },
    ],
  },
  {
    id: "backup",
    title: bi("备份与恢复", "Back up and restore"),
    summary: bi("导出归档，安心开会。", "Export an archive before big sessions."),
    steps: [
      {
        text: bi("完全退出并重新打开 Console Neo。在创建本地会话之前，打开菜单“Edit → Import or Export Data”。",
          "Quit Console Neo completely and open it again. Before creating a local session, open Edit → Import or Export Data from the menu."),
      },
      {
        text: bi("导出归档并存放在安全的位置。重要会议前后各导出一份，并在另一处保留副本。",
          "Export an archive and keep it somewhere safe. Take one before and after each major session, with a copy on separate storage."),
      },
      {
        text: bi("导入会用归档替换这台电脑上的全部数据，包括每个委员会、文件与笔记。导入前请先导出当前数据。",
          "Importing replaces everything on this computer with the archive, including every committee, document, and note. Export your current data first."),
      },
    ],
  },
  {
    id: "reference",
    title: bi("参考", "Reference"),
    summary: bi("动议类型、角色、连接与快捷键。", "Motion types, roles, connections, shortcuts."),
    sections: [
      {
        title: bi("动议类型", "Motion types"),
        items: [
          bi("有主持核心磋商 → 发言名单。", "Moderated Caucus → speakers' list."),
          bi("自由磋商、全体协商、自由辩论、暂停会议 → 计时器。", "Unmoderated Caucus, Consultation of the Whole, Free Debate, Pause Meeting → timer."),
          bi("延长上一磋商 → 按最近执行的磋商或轮流发言再创建一次，时长可修改。", "Prolong Last Caucus → repeats the most recently executed caucus or tour, with editable durations."),
          bi("轮流发言 → 由当前出席席位组成的发言名单。", "Tour de Table → speakers' list of the seats present."),
          bi("文件相关 → 打开所附文件。", "Document-Related → opens the attached document."),
          bi("程序性投票 → 简单多数；实质性投票 → 不计弃权三分之二。", "Procedural Vote → simple majority. Substantive Vote → two-thirds excluding abstentions."),
          bi("开启辩论、休会、闭会、其他动议 → 记录结果。", "Open Debate, Suspend Meeting, Adjourn Meeting, Other → outcome recorded."),
        ],
      },
      {
        title: bi("角色", "Roles"),
        items: [
          bi("主席可以修改会议、编辑笔记、主持同步投影；查看者可以浏览会议并打开自己的会场屏幕。", "Chairs change the meeting, edit notes, and host the synced cast. Viewers browse the meeting and can open their own room screen."),
          bi("验证码每 30 秒更新，密码每 10 分钟更新，只影响新的连接。", "Codes refresh every 30 seconds and passwords every 10 minutes, for new connections only."),
          bi("[icon:settings] 设置中的“断开所有连接并重置密码”会让所有参与者重新加入。", "Disconnect Everyone & Reset Passwords in [icon:settings] Settings makes every participant join again."),
        ],
      },
      {
        title: bi("连接", "Connections"),
        items: [
          bi("默认“优先局域网，中继备用”。在隔离的场地网络中，可在 [icon:settings] 设置里选择“始终使用中继”。", "The default is LAN first, relay as backup. On an isolated venue network, choose Always use the relay in [icon:settings] Settings."),
          bi("连接中断时显示“连接已断开，正在重连…”，恢复后自动同步期间的变化。", "If the connection drops, a reconnecting banner appears, and everything that changed meanwhile syncs in once it's back."),
          bi("中继只转发会话流量，委员会数据保存在主持电脑上。", "The relay only forwards session traffic; committee data stays on the host."),
        ],
      },
      {
        title: bi("笔记与数据", "Notes and data"),
        items: [
          bi("主席可为动议、计时器、文件、投票、发言名单与单次发言添加协作笔记，支持 Markdown 快捷输入。", "Chairs can attach shared notes to motions, timers, documents, votes, speakers' lists, and single speeches, with Markdown shortcuts."),
          bi("[icon:equalizer] 数据页汇总会议与各代表团的发言、动议与投票，可按最多三列组合排序。", "[icon:equalizer] Data summarizes speeches, motions, and votes for the meeting and each delegation, sortable by up to three columns."),
        ],
      },
      {
        title: bi("快捷键", "Keyboard shortcuts"),
        items: [
          bi("[key:⌘/Ctrl] + [key:1]…[key:9]：委员会、席位、动议、发言名单、计时器、文件、投票、数据、设置。", "[key:⌘/Ctrl] + [key:1]…[key:9]: Committee, Seats, Motions, Speakers' Lists, Timers, Documents, Voting, Data, Settings."),
          bi("[key:⌘/Ctrl] + [key:\\]：回到控制窗口。[key:⌘/Ctrl] + [key:Shift] + [key:|]：打开会场屏幕。", "[key:⌘/Ctrl] + [key:\\]: back to the controller. [key:⌘/Ctrl] + [key:Shift] + [key:|]: open the room screen."),
          bi("[key:Esc] 关闭对话框，[key:⌘/Ctrl] + [key:Enter] 提交。", "[key:Esc] closes a dialog; [key:⌘/Ctrl] + [key:Enter] submits."),
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: bi("问题排查", "Troubleshooting"),
    summary: bi("连接、投影与投票的常见情况。", "Connecting, casting, and votes."),
    sections: [
      {
        title: bi("连接", "Connecting"),
        items: [
          bi("附近的会话为空：确认两台电脑在同一网络。启动页提示需要网络时，点击 [btn:连接到会话...|settings_ethernet] 重新检测。", "Nearby sessions are empty: check both laptops are on the same network. If the launch page asks for a network, click [btn:Connect to a Session...|settings_ethernet] to check again."),
          bi("验证码无效：使用主持电脑上当前显示的验证码。", "Code rejected: use the code the host shows right now."),
          bi("会场网络互相隔离：在 [icon:settings] 设置中选择“始终使用中继”。", "The venue network isolates devices: choose Always use the relay in [icon:settings] Settings."),
          bi("无法主持：同一台电脑上已有另一个实例在使用端口 3066，关闭它后重试。", "Hosting fails: another copy on this computer is using port 3066. Close it and try again."),
        ],
      },
      {
        title: bi("投影", "Casting"),
        items: [
          bi("会场屏幕不见了：点击底栏最右侧的 [icon:cast]，或按 [key:⌘/Ctrl] + [key:Shift] + [key:|]。", "The room screen is gone: click [icon:cast] at the far right of the bottom bar, or press [key:⌘/Ctrl] + [key:Shift] + [key:|]."),
          bi("会场屏幕停在旧页面：点击 [icon:pause_presentation] 成为投影主持。", "The room screen stays on an old page: click [icon:pause_presentation] to host the cast."),
        ],
      },
      {
        title: bi("计时、文件与投票", "Timers, documents, and votes"),
        items: [
          bi("没有提醒声音：检查系统的通知与声音权限，以及本机的提醒规则。", "No reminder sound: check the system's notification and sound permissions, and this laptop's reminder rules."),
          bi("文件预览：PDF 与图片可以预览和投影，其他格式可以保存。", "Document previews: PDFs and images preview and cast; other formats can be saved."),
          bi("投票席位不对：席位在创建投票时锁定，重新创建投票即可。", "A vote has the wrong seats: seats lock when the vote is created, so create it again."),
        ],
      },
    ],
  },
];
