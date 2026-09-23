"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Lang = "zh" | "en";
type Localized = { zh: string; en: string };

type GuideSection = {
  title: Localized;
  intro?: Localized;
  bullets?: Localized[];
  note?: Localized;
  danger?: boolean;
};

type Guide = {
  id: string;
  icon: string;
  title: Localized;
  summary: Localized;
  reading: Localized;
  sections: GuideSection[];
};

const bi = (zh: string, en: string): Localized => ({ zh, en });
const tx = (value: Localized, lang: Lang) => value[lang];

const navigation = [
  { id: "product", label: bi("产品", "Product") },
  { id: "workflow", label: bi("工作流程", "Workflow") },
  { id: "docs", label: bi("用户指南", "Guides") },
  { id: "privacy", label: bi("数据与隐私", "Data & privacy") },
  { id: "license", label: bi("授权与致谢", "License & credits") },
];

const features = [
  {
    icon: "hub",
    title: bi("协作，但不喧闹", "Collaboration without noise"),
    body: bi(
      "主席、联席主席与只读观察员共享同一会议状态。局域网优先，必要时使用中继。",
      "Chairs, co-chairs, and read-only viewers share one live meeting state. LAN first, relay when needed.",
    ),
  },
  {
    icon: "present_to_all",
    title: bi("控制台与投影分离", "Controller and cast, separated"),
    body: bi(
      "主席看到操作细节，现场只看到清晰的议程、名单、计时、文件与表决。",
      "The chair keeps the controls; the room sees a composed agenda, queue, timer, document, or vote.",
    ),
  },
  {
    icon: "gavel",
    title: bi("完整会议工具链", "The full meeting toolkit"),
    body: bi(
      "点名、动议、发言名单、独立计时、文件展示、程序性与实质性表决，一处完成。",
      "Roll call, motions, speakers, timers, documents, procedural and substantive voting—one flow.",
    ),
  },
  {
    icon: "insights",
    title: bi("信息始终可解释", "Information that reconciles"),
    body: bi(
      "法定人数、门槛、结果、历史和代表参与数据保持一致，并在控制端与投影端清楚显示。",
      "Quorum, thresholds, outcomes, history, and delegate participation stay legible and consistent.",
    ),
  },
];

const workflow = [
  {
    number: "01",
    title: bi("创建会议", "Create a session"),
    body: bi("在主持设备上创建本地会话，再新建或恢复委员会。", "Host locally, then create or resume a committee."),
  },
  {
    number: "02",
    title: bi("准备会场", "Prepare the room"),
    body: bi("录入席位、完成点名，并在第二块屏幕打开投影。", "Add seats, take roll, and open the cast on a second display."),
  },
  {
    number: "03",
    title: bi("邀请协作", "Invite collaborators"),
    body: bi("向联席主席发送主席验证码；观察员仅使用只读验证码。", "Share the Chair code with co-chairs and the Viewer code with observers."),
  },
  {
    number: "04",
    title: bi("推进议程", "Run the agenda"),
    body: bi("记录动议、执行通过项目、管理发言与表决，并让投影自动跟随。", "Resolve motions, run their actions, manage speaking and votes, and let the cast follow."),
  },
];

const guides: Guide[] = [
  {
    id: "start",
    icon: "flag",
    title: bi("从这里开始", "Start here"),
    summary: bi("认识 Console Neo，并在十分钟内完成第一次会议。", "Understand Console Neo and run your first meeting in ten minutes."),
    reading: bi("约 6 分钟", "6 min read"),
    sections: [
      {
        title: bi("它是什么", "What it is"),
        intro: bi(
          "Console Neo 是面向模拟联合国会场的桌面控制台。一个设备负责主持与本地存储，独立投影窗口负责面向会场展示，其他安装了应用的设备可作为主席或只读观察员加入。",
          "Console Neo is a desktop control console for Model United Nations. One device hosts and stores the meeting, a separate cast window faces the room, and other devices running the app can join as Chairs or read-only Viewers.",
        ),
        bullets: [
          bi("控制窗口：主席操作会议，不直接面向观众。", "Controller: where the chair operates the meeting."),
          bi("投影窗口：只显示当前公开内容和会议门槛。", "Cast: the audience-facing view and live thresholds."),
          bi("委员会：长期保存的席位、议程项目、文件与历史。", "Committee: the persistent roster, agenda items, files, and history."),
          bi("会话：让多台设备发现并连接到主持设备。", "Session: the live connection shared by participating devices."),
        ],
      },
      {
        title: bi("十分钟快速开始", "Ten-minute quick start"),
        bullets: [
          bi("启动应用，选择语言，然后选择“创建本地会话”。", "Launch the app, choose a language, and select Create a Local Session."),
          bi("创建委员会，输入名称，并以主席身份进入。", "Create a committee, name it, and enter as Chair."),
          bi("在“席位”中每行输入一个代表团，再逐一设置出席状态。", "Enter one delegation per line in Seats, then record attendance."),
          bi("点击最右侧投影图标打开投影窗口；右键可在当前屏幕窗口化预演。", "Open the cast with the rightmost cast icon; right-click for a windowed rehearsal."),
          bi("创建一项动议，标记为通过，然后选择“执行并前往”。", "Create a motion, mark it Passed, then choose Execute & Go."),
          bi("会议结束前检查“数据”与历史；完全退出并重新启动应用后，再按需导出整机数据归档。", "Before closing, review Data and history. Fully quit and relaunch the app before exporting a whole-store archive when needed."),
        ],
      },
      {
        title: bi("私有访问、安装与更新", "Private access, installation, and updates"),
        bullets: [
          bi("本站不提供公开下载，也不宣称现有安装包已经核验。测试者应只接受维护者从当前源码重新构建并测试的安装包。", "This site offers no public download and does not claim an existing package is verified. Testers should accept only a package rebuilt from current source and tested by the maintainer."),
          bi("项目已配置生成兼容 Apple 芯片与 Intel Mac 的 macOS 通用应用；发布前仍需核验系统要求、签名、公证和首次打开流程。", "The project is configured to produce a macOS Universal app for Apple silicon and Intel Macs; system requirements, signing, notarization, and first-launch behavior still need release-specific verification."),
          bi("当前没有对外发布的自动更新渠道或版本政策。更新时获取新的已核验构建，并在替换应用前导出整机数据归档。", "There is no public automatic-update channel or published version policy. Obtain a newly verified build and export a whole-store archive before replacing the app."),
          bi("不要使用旧 README 中的下载地址、版本说明或仓库内现有 dist 包。", "Do not use legacy README download/version guidance or existing packages in the repository’s dist directory."),
        ],
        note: bi("对外发布前，维护者应为具体构建补充下载来源、校验信息、最低 macOS 版本、签名/公证状态与更新说明。", "Before release, the maintainer must publish the download source, integrity information, minimum macOS version, signing/notarization status, and update notes for that exact build."),
      },
      {
        title: bi("会前检查", "Pre-meeting checklist"),
        bullets: [
          bi("主持设备已接通电源，系统通知与声音权限可用。", "Host device is powered; notifications and audio are allowed."),
          bi("第二块屏幕已设置为扩展显示，而不是镜像。", "The room display is configured as an extended display, not mirrored."),
          bi("席位、文件和委员会名称已经复核。", "Roster, documents, and committee name have been reviewed."),
          bi("联席主席使用主席验证码，观察员只收到只读验证码。", "Co-chairs have the Chair code; observers only have the Viewer code."),
          bi("主持设备的全部本地数据已有最新导出归档，并已确认文件确实存在。", "All local data on the host has a recent exported archive, and the file has been verified to exist."),
        ],
        note: bi("macOS 通用打包已经配置，但当前仓库内的安装包早于近期修复；重新构建并完成端到端核验后才能分发。", "macOS Universal packaging is configured, but repository packages predate recent fixes; rebuild and complete end-to-end verification before distribution."),
      },
    ],
  },
  {
    id: "session",
    icon: "settings_ethernet",
    title: bi("会话与委员会", "Sessions & committees"),
    summary: bi("主持、加入、角色权限、验证码与委员会切换。", "Host, join, understand roles and codes, and switch committees safely."),
    reading: bi("约 9 分钟", "9 min read"),
    sections: [
      {
        title: bi("主持本地会话", "Host a local session"),
        bullets: [
          bi("在启动页选择“创建本地会话”；主持设备会保存全部委员会数据。", "Choose Create a Local Session; this host stores all committee data."),
          bi("从现有委员会恢复，或创建新委员会。多个委员会可存在于同一会话。", "Resume an existing committee or create a new one. One session can hold multiple committees."),
          bi("选择“开始主持”获得写入权限；“只读进入”用于安全查看。", "Choose Start Chairing for write access, or enter read-only for safe inspection."),
          bi("默认服务端口为 3066；同一设备上重复主持可能发生端口冲突。", "The default server port is 3066; starting a second host on the same device may conflict."),
        ],
      },
      {
        title: bi("加入已有会话", "Join an existing session"),
        bullets: [
          bi("在同一局域网内，可从附近会话列表选择；也可输入会话 ID 与当前验证码。", "On the same LAN, choose a nearby session or enter its Session ID and current code."),
          bi("主席验证码授予写入权限；观察者验证码只允许浏览和跟随投影。", "The Chair code grants write access; the Viewer code permits browsing and following the cast."),
          bi("六位验证码每 30 秒更新，用于新连接；已连接设备不会因此退出。", "Six-character codes rotate every 30 seconds for new joins; connected devices remain signed in."),
          bi("高级连接可使用服务地址与主席/观察员长密码；长密码每 10 分钟为新连接轮换一次，已有连接和令牌不受自动轮换影响。", "Advanced connection accepts a server address and role-specific Chair/Viewer long password. Long passwords rotate every 10 minutes for new joins; established connections and tokens survive automatic rotation."),
          bi("不要公开主席凭据；“重置连接凭据”与自动轮换不同，会主动断开所有参与者。", "Never publish Chair credentials. Unlike automatic rotation, Reset Credentials intentionally disconnects every participant."),
        ],
        note: bi("读者/Viewer 是同一个只读角色。界面中可能显示 Viewer，本指南称为“观察员（只读）”。", "Reader and Viewer refer to the same read-only role. The interface may say Viewer; this guide calls it Viewer (read-only)."),
      },
      {
        title: bi("委员会与本地设置", "Committee and device settings"),
        bullets: [
          bi("委员会名称与投影品牌文字会同步给所有设备。", "Committee name and cast brand text sync to every device."),
          bi("语言、路由偏好、提醒声音和非投影页面策略保存在每台设备。", "Language, route preference, reminder sounds, and cast fallback are per-device settings."),
          bi("切换委员会不会停止本地会话；返回启动页可连接其他服务器。", "Switching committee does not stop the local session; return to launch to connect elsewhere."),
          bi("“重置连接凭据”会断开现有参与者，仅在确有安全需要时使用。", "Reset Credentials disconnects participants. Use it only for a genuine access concern."),
        ],
      },
    ],
  },
  {
    id: "meeting",
    icon: "gavel",
    title: bi("主持一场会议", "Run a meeting"),
    summary: bi("从点名和动议，到发言、文件、表决与闭会。", "From roll call and motions to speaking, documents, votes, and adjournment."),
    reading: bi("约 16 分钟", "16 min read"),
    sections: [
      {
        title: bi("1. 点名与门槛", "1. Roll call and thresholds"),
        bullets: [
          bi("“席位”中每行一个代表团；空行会被忽略。", "Enter one delegation per line in Seats; blank lines are ignored."),
          bi("设置出席后，底部栏自动计算简单多数、三分之二与五分之一。", "Attendance automatically updates simple majority, two-thirds, and one-fifth thresholds."),
          bi("投影席位页可向会场公开出席情况。", "Cast the Seats page when attendance should be visible to the room."),
          bi("修改席位名单会重置全部出席状态，请在会中谨慎操作。", "Editing the roster resets all attendance states. Avoid it mid-meeting unless necessary."),
        ],
        danger: true,
      },
      {
        title: bi("2. 记录与处理动议", "2. Record and resolve motions"),
        bullets: [
          bi("选择动议类型、提案方和所需参数；草稿可直接在动议投影中预览。", "Choose a motion type, proposer, and required parameters; the draft can appear on the motions cast."),
          bi("按时间或干扰程度排序，并可只显示待处理项目。", "Sort chronologically or by disruptiveness, and filter to pending items."),
          bi("将结果设为通过、失败或撤回；每项动议可独立控制是否投影。", "Set Passed, Failed, or Withdrawn, and control cast visibility per motion."),
          bi("可执行的通过动议会显示“执行并前往”，创建相应名单、计时或表决。", "Executable passed motions offer Execute & Go, creating the corresponding list, timer, or vote."),
        ],
      },
      {
        title: bi("3. 发言名单与计时", "3. Speakers and timers"),
        bullets: [
          bi("创建名单时设置总时长与单人时长；总时长为 0 表示不限时。", "Set total and per-speaker time; a total of 0 means unlimited."),
          bi("用搜索或模糊匹配添加代表团，拖拽调整顺序；“更多声音”优先低参与代表。", "Add delegations with fuzzy search, drag to reorder, and use More Voices to surface lower participation."),
          bi("开始/暂停、下一位与撤销都有防误触设计；下一位操作有 700 毫秒冷却。", "Start/pause, Next, and Undo are guarded against mispresses; Next has a 700 ms cooldown."),
          bi("独立计时适用于非正式磋商、自由辩论与休会；提醒规则由各设备单独设置。", "Standalone timers fit unmoderated caucus, free debate, and pauses; reminder rules are device-local."),
        ],
      },
      {
        title: bi("4. 文件与表决", "4. Documents and voting"),
        bullets: [
          bi("PDF 与图片可预览和投影；其他格式仅提供保存/下载。", "PDFs and images can be previewed and cast; other formats are save/download only."),
          bi("PDF 支持 50%–300% 缩放；位置与缩放同步到投影并保持当前阅读位置。", "PDF zoom ranges from 50%–300%; position and zoom sync while preserving the current reading point."),
          bi("表决轮数设为 0 表示不限轮次；目标设为 0 表示尚未决定，也可选择固定目标或当前多数门槛。", "Set rounds to 0 for unlimited rounds. A target of 0 means undecided; fixed and current-majority targets are also available."),
          bi("创建表决时会冻结当前出席席位；之后修改出席不会改变该表决的选民集。", "A vote snapshots currently present seats at creation; later attendance changes do not alter its voter set."),
          bi("进入下一轮时，已有非零投票会保留；自动模式只重新询问仍为 0（过/未投）的席位，不会重置所有人。", "Across rounds, prior nonzero votes persist. Automatic entry revisits only seats still at 0 (Pass/No Vote); it does not reset everyone."),
          bi("实质性表决的三分之二门槛会排除弃权后动态计算。", "Substantive two-thirds dynamically excludes abstentions from its denominator."),
          bi("最终结果显示赞成、反对、弃权与过/未投票；计划轮次结束后仍可确认追加一轮。", "Results reconcile For, Against, Abstain, and Pass/No Vote; an extra round can be confirmed after planned rounds."),
        ],
        note: bi("数值 0 在录入过程中无法区分“尚未处理”与“过/未投”；只有完成轮次后的展示才将其标为过/未投票。", "During entry, zero cannot distinguish unresolved from Pass/No Vote. Only the completed-round presentation labels it Pass/No Vote."),
      },
      {
        title: bi("5. 结束与复核", "5. Close and review"),
        bullets: [
          bi("记录暂停、休会与闭会动议的最终结果。", "Record the final outcome of pause, suspend, and adjourn motions."),
          bi("在“数据”中复核发言时间、动议、表决、名单、文件与代表参与度。", "Review speaking time, motions, votes, lists, files, and participation in Data."),
          bi("完全退出并重新启动应用，在创建本地会话之前打开“编辑 → 导入/导出”，导出包含所有委员会、文件与笔记的整机归档。", "Fully quit and relaunch the app. Before creating a local session, open Edit → Import/Export and export the whole store, including every committee, file, and note."),
        ],
      },
    ],
  },
  {
    id: "collaboration",
    icon: "groups",
    title: bi("协作与投影", "Collaboration & casting"),
    summary: bi("多主席、只读观察、局域网/中继与同步投影。", "Multiple chairs, read-only viewers, LAN/relay, and synchronized casting."),
    reading: bi("约 10 分钟", "10 min read"),
    sections: [
      {
        title: bi("角色权限", "Roles and permissions"),
        bullets: [
          bi("主席：可修改会议、编辑协作笔记并申请成为同步投影主持。", "Chair: can change meeting state, edit collaborative notes, and claim synchronized cast hosting."),
          bi("观察员（只读）：可浏览普通同步会议状态并打开自己的投影，但不能查看主席专用笔记、修改会议或接管投影。", "Viewer (read-only): can browse ordinary synchronized meeting state and open a local cast, but cannot access Chair-only notes, mutate the meeting, or take over hosting."),
          bi("主席更改会实时广播；只有发言名单的席位编辑具有三方过期写入合并处理，其他操作并非普遍无冲突。", "Chair changes broadcast live. Only speakers-list seat edits have three-way stale-write merge handling; other operations are not generally conflict-free."),
          bi("联席主席应明确分配动议结果、计时控制、表决推进、席位编辑与删除操作的负责人。", "Co-chairs should assign ownership for motion outcomes, timer controls, vote progression, roster edits, and destructive actions."),
        ],
      },
      {
        title: bi("连接路径", "Connection paths"),
        bullets: [
          bi("默认“局域网优先”：同网设备直连；不可用时中继作为备选。", "LAN-first is the default: nearby devices connect directly, with relay as fallback."),
          bi("“始终中继”适用于网络隔离的场地；也可配置自定义中继地址。", "Always Relay helps on isolated venue networks; a custom relay URL can also be configured."),
          bi("委员会数据由主持应用保存；连接设备会接收实时状态，中继仅转发会话流量。", "Committee data is stored by the host app; connected devices receive live state, and the relay forwards session traffic."),
          bi("局域网断开通常保留 30 秒重连窗口，中继会话通常保留 90 秒。", "LAN disconnects generally have a 30-second grace period; relay sessions generally have 90 seconds."),
        ],
      },
      {
        title: bi("同步投影", "Synchronized casting"),
        bullets: [
          bi("最右侧投影窗口图标只负责打开/关闭本机投影；右键或 Command/Ctrl 点击可窗口化打开。", "The rightmost projector-window control only opens/closes this device’s cast; right-click or Command/Ctrl-click opens it windowed."),
          bi("相邻的页面/内容投影图标负责申请或释放同步投影主持；右键或 Command/Ctrl 点击该图标会让控制窗口跳到当前投影页面。", "The adjacent page/content-cast control claims or releases synchronized cast hosting. Right-click or Command/Ctrl-click it to jump the controller to the currently cast page."),
          bi("同步开启时，其他设备的投影窗口镜像主持者的投影页面；其他设备的控制窗口不会自动跟随。", "With sync enabled, other devices’ cast windows mirror the host’s cast page; their controller pages do not automatically follow."),
          bi("另一位主席可确认接管；观察员只能跟随，不能主持同步投影。", "Another Chair can confirm a takeover; Viewers can only follow and cannot host synchronized casting."),
          bi("同步关闭后，各设备可独立投影。非投影页面可选择回到基础页或保留上一页。", "With sync off, each device casts independently. Non-castable pages can return to Base or Keep Last."),
          bi("动议排序/滚动、名单当前发言者、文件缩放/滚动和表决位置均会同步。", "Motion order/scroll, active speaker, document zoom/scroll, and vote position all synchronize."),
        ],
      },
    ],
  },
  {
    id: "reference",
    icon: "menu_book",
    title: bi("功能参考", "Feature reference"),
    summary: bi("动议类型、表决规则、笔记、数据与键盘操作。", "Motion types, vote behavior, notes, data, and keyboard operation."),
    reading: bi("约 18 分钟", "18 min read"),
    sections: [
      {
        title: bi("14 种动议与执行结果", "Fourteen motion types and outcomes"),
        bullets: [
          bi("有主持核心磋商 → 发言名单；需单人时长，总时长可为不限。", "Moderated Caucus → speakers list; per-speaker time required, total may be unlimited."),
          bi("无主持核心磋商 → 独立计时。", "Unmoderated Caucus → standalone timer."),
          bi("延长上一磋商 → 复制最近一次磋商的类型与参数，并创建新的名单或计时。", "Prolong Last Caucus → copies the prior caucus type and parameters, then creates a new list or timer."),
          bi("全体协商 / 自由辩论 / 暂停会议 → 独立计时。", "Consultation of the Whole / Free Debate / Pause Meeting → standalone timer."),
          bi("轮流发言 → 以当前出席席位创建名单。", "Tour de Table → list built from currently present seats."),
          bi("开启辩论 / 休会 / 闭会 / 其他 → 记录结果，不创建新页面。", "Open Debate / Suspend Meeting / Adjourn Meeting / Other → recorded outcome only."),
          bi("文件相关 → 打开关联文件；至少需要一个现有文件。", "Document-related → opens an attached existing document; at least one is required."),
          bi("程序性表决 → 一轮、当前简单多数；实质性表决 → 一轮、动态三分之二。", "Procedural Vote → one round, current simple majority; Substantive Vote → one round, dynamic two-thirds."),
        ],
      },
      {
        title: bi("发言名单细节", "Speakers-list behavior"),
        bullets: [
          bi("可搜索、重命名、删除、拖动排序，并按活跃状态筛选。", "Search, rename, delete, drag to reorder, and filter active lists."),
          bi("当前与下一位发言者、总剩余时间和单人剩余时间会同步显示。", "Current/next speaker and both remaining timers stay synchronized."),
          bi("计时未运行时可编辑时长；撤销可恢复指针、时间与运行状态快照。", "Durations are editable while stopped; Undo restores pointer, timing, and running state."),
          bi("发言统计在开始时计数一次，并累计实际运行秒数。", "Speech count increments once on start and accrues only active seconds."),
        ],
      },
      {
        title: bi("笔记与数据", "Notes and data"),
        bullets: [
          bi("主席可为动议、计时、文件、表决、名单与单次发言建立协作笔记；观察员不能打开主席专用笔记。", "Chairs can attach collaborative notes to motions, timers, files, votes, lists, and individual speeches; Viewers cannot open Chair-only notes."),
          bi("笔记使用富文本与 Markdown 快捷输入，并在多主席之间实时同步。", "Notes support rich text and Markdown shortcuts with live co-chair synchronization."),
          bi("每个委员会最多 300 条笔记，每条硬性上限为 5,000 字符。", "A committee has a hard limit of 300 notes and 5,000 characters per note."),
          bi("删除计时、表决、文件、名单、动议或单次发言，会级联删除对应附属笔记。", "Deleting a timer, vote, document, list, motion, or individual speech cascades to its attached notes."),
          bi("数据页汇总会议与代表维度；独立计时不计入发言时间。", "Data summarizes meeting and delegate metrics; standalone timers do not count as speaking time."),
          bi("代表表最多组合三个排序字段；有历史活动的已删除代表仍保留在数据中。", "Delegate tables can combine up to three sort fields; removed delegates with history remain in analytics."),
        ],
        danger: true,
      },
      {
        title: bi("常用快捷键", "Keyboard shortcuts"),
        bullets: [
          bi("Command/Ctrl + \\：聚焦控制窗口。", "Command/Ctrl + \\: focus the controller."),
          bi("Command/Ctrl + Shift + |：打开或聚焦投影窗口。", "Command/Ctrl + Shift + |: open or focus the cast."),
          bi("Command/Ctrl + 1…9：跳转到主要页面。", "Command/Ctrl + 1…9: jump to primary pages."),
          bi("Escape：关闭对话框；Command/Ctrl + Enter：提交当前表单。", "Escape closes a dialog; Command/Ctrl + Enter submits the current form."),
          bi("发言名单：A/左键上一位，S/下键暂停，D/右键下一位，Space 开始/暂停。", "Speakers: A/Left previous, S/Down pause, D/Right next, Space start/pause."),
          bi("表决开始时按住 Alt，可跳过自动逐一录入并进入手动模式。", "Hold Alt while starting a vote to use manual rather than automatic entry."),
        ],
      },
    ],
  },
  {
    id: "data",
    icon: "inventory_2",
    title: bi("数据、备份与管理", "Data, backup & administration"),
    summary: bi("本地持久化、导入导出、凭据安全与恢复边界。", "Local persistence, import/export, credential safety, and recovery boundaries."),
    reading: bi("约 8 分钟", "8 min read"),
    sections: [
      {
        title: bi("数据保存在哪里", "Where data lives"),
        intro: bi(
          "委员会及其文件存储在主持设备的 Console Neo 用户数据目录中。关闭应用后数据仍保留；应用完整重启会返回启动页，但委员会可以再次恢复。",
          "Committees and uploaded files live in Console Neo’s user-data directory on the host. Data persists after closing; a full restart returns to launch, where committees can be resumed.",
        ),
        bullets: [
          bi("连接的主席和观察员会接收实时会话状态。", "Connected Chairs and Viewers receive live session state."),
          bi("中继用于传输连接，不是云端委员会存储。", "The relay transports connections; it is not cloud committee storage."),
          bi("不要宣称所有数据始终留在单一设备；协作本身需要发送状态。", "Do not assume all data remains on one device; collaboration transmits live state."),
        ],
      },
      {
        title: bi("导出备份", "Export a backup"),
        bullets: [
          bi("先结束或停止嵌入式主持服务；主持期间导入/导出菜单不可用。", "Stop the embedded host first; Import/Export is unavailable while hosting."),
          bi("打开“编辑 → 导入/导出”，将导出归档拖到安全位置。", "Open Edit → Import/Export and drag the export archive to a safe location."),
          bi("在重大会议前后各保留一份带日期的归档，并在另一存储位置保留副本。", "Keep dated archives before and after major meetings, with a copy on separate storage."),
        ],
      },
      {
        title: bi("导入会替换全部本地数据", "Import replaces all local data"),
        intro: bi(
          "导入不是合并。导入一个归档会替换本机 Console Neo 的整个存储目录，包括所有委员会、文件与笔记。",
          "Import is not a merge. Importing one archive replaces the entire local Console Neo storage directory, including every committee, file, and note.",
        ),
        bullets: [
          bi("导入前先导出当前数据并验证备份文件已保存。", "Export current data and confirm the archive exists before importing."),
          bi("只接受可信的单个归档；完成后逐一复核委员会和文件。", "Use one trusted archive, then review every committee and file afterward."),
          bi("若导入错误，停止操作并使用刚刚创建的备份恢复。", "If the import is wrong, stop and restore the backup you just created."),
        ],
        danger: true,
      },
    ],
  },
  {
    id: "troubleshooting",
    icon: "build",
    title: bi("故障排查", "Troubleshooting"),
    summary: bi("连接、投影、文件、表决、提醒与数据恢复。", "Connections, cast, documents, votes, reminders, and recovery."),
    reading: bi("约 12 分钟", "12 min read"),
    sections: [
      {
        title: bi("无法主持或加入", "Cannot host or join"),
        bullets: [
          bi("同一设备已有主持进程：关闭重复实例，或确认默认端口 3066 未被占用。", "Another host is running: close the duplicate instance or verify default port 3066 is free."),
          bi("验证码无效：请主持人重新显示当前验证码；短码会定时轮换。", "Invalid code: ask the host to reveal the current code; short codes rotate regularly."),
          bi("附近列表为空：确认两台设备在同一局域网，检查 Wi‑Fi 状态图标并手动重新检测。", "No nearby session: verify the same LAN, inspect the Wi‑Fi status icon, and recheck manually."),
          bi("局域网不可用：检查云图标与路由偏好，必要时切换“始终中继”。", "LAN unavailable: inspect relay status and routing preference; use Always Relay when appropriate."),
          bi("两种路径均不可用时，主持设备仍可本地运行，但其他设备无法协作。", "If both paths fail, the host can continue locally but other devices cannot collaborate."),
        ],
      },
      {
        title: bi("投影不正确", "Cast is wrong"),
        bullets: [
          bi("没有窗口：点击最右侧投影图标，或使用 Command/Ctrl + Shift + |。", "No window: use the rightmost cast control or Command/Ctrl + Shift + |."),
          bi("页面不跟随：确认“同步投影”开启，并确认当前设备是否为投影主持。", "Page does not follow: ensure Sync Cast is on and identify the current cast host."),
          bi("另一主席正在主持：由其释放，或在本机确认接管。观察员不能接管。", "Another Chair hosts: ask them to release or confirm takeover locally. Viewers cannot take over."),
          bi("切到设置页后内容改变：检查非投影页面策略是“基础页”还是“保留上一页”。", "Content changes on Settings: check whether fallback is Base Page or Keep Last."),
          bi("单屏预演：投影关闭时右键最右侧图标，以窗口模式打开。", "One-screen rehearsal: right-click the cast control while off to open windowed."),
        ],
      },
      {
        title: bi("计时、文件与表决", "Timers, files, and votes"),
        bullets: [
          bi("没有提醒声音：检查操作系统通知/声音权限，以及本机提醒规则；设置不会同步到其他设备。", "No reminder sound: check OS permissions and this device’s reminder rules; they do not sync."),
          bi("文件不能预览：只有 PDF 和图片可预览；其他格式只能保存。", "File will not preview: only PDFs and images preview; other formats can only be saved."),
          bi("拖入替换失败：详情页替换要求新文件 MIME 类型与原文件一致。", "Replacement rejected: detail-page replacement requires the same MIME type."),
          bi("表决席位不对：选民集在创建表决时冻结；请重新创建，而不是修改当前席位。", "Wrong voter set: it freezes when the vote is created; create a new vote rather than editing attendance."),
          bi("实质性门槛变化：弃权不计入分母，因此三分之二目标会动态调整。", "Substantive target changes: abstentions leave the denominator, so two-thirds updates dynamically."),
        ],
      },
      {
        title: bi("数据看起来不一致", "Data appears inconsistent"),
        bullets: [
          bi("独立计时不计入发言时间；只有发言名单中的实际运行时间会累计。", "Standalone timers do not count as speaking time; only active speakers-list time accrues."),
          bi("席位被删除但代表仍出现：有历史活动的代表会保留在数据中。", "Removed delegation still appears: delegates with activity remain in analytics."),
          bi("附属笔记消失：删除动议、名单、文件或发言会级联删除对应笔记。", "Attached note disappeared: deleting its motion, list, file, or speech cascades to the note."),
          bi("重新加载后回到启动页：完整重启不会自动回到会话；选择恢复委员会即可。", "Restart returned to launch: a full restart does not auto-resume; choose the committee again."),
        ],
      },
    ],
  },
  {
    id: "faq",
    icon: "help_outline",
    title: bi("常见问题", "FAQ"),
    summary: bi("部署、网络、隐私、许可与当前支持范围。", "Deployment, networking, privacy, licensing, and current support."),
    reading: bi("约 5 分钟", "5 min read"),
    sections: [
      {
        title: bi("这是网页应用或移动应用吗？", "Is this a web or mobile app?"),
        intro: bi("不是。当前 Console Neo 是桌面应用，加入会议的主席与观察员也需要安装应用。", "No. Console Neo is currently a desktop app; joining Chairs and Viewers also need the app installed."),
      },
      {
        title: bi("没有互联网也能用吗？", "Can it work without the internet?"),
        intro: bi("单机主持和投影可以。多设备协作需要可用的同一局域网，或互联网中继连接。", "Solo chairing and casting can. Multi-device collaboration needs a shared LAN or an internet relay path."),
      },
      {
        title: bi("数据是否上传到云端？", "Is committee data stored in the cloud?"),
        intro: bi("主持应用保存委员会。协作设备会接收实时状态；配置中继时，流量通过中继转发。", "The host app stores the committee. Collaborating devices receive live state, and a configured relay forwards traffic."),
      },
      {
        title: bi("目前支持哪些平台？", "Which platforms are currently supported?"),
        intro: bi("当前已核实的是私有 macOS 通用构建，适用于 Apple 芯片和 Intel Mac。尚未发布经过核实的 Windows/Linux 版本。", "The currently verified artifact is a private macOS Universal build for Apple silicon and Intel Macs. No current Windows/Linux release is claimed."),
      },
      {
        title: bi("Console Neo 是开源项目吗？", "Is Console Neo open source?"),
        intro: bi("继承的 2016/2018 代码按 MIT 许可使用；当前大幅改版仍为私有项目，新增代码的许可尚未决定。详见本页授权说明。", "Inherited 2016/2018 code is used under MIT. The substantially revised project remains private while the license for new work is undecided. See License & credits below."),
      },
    ],
  },
];

const mitLicense = `MIT License

Copyright (c) 2016 Liu Xiaoyi
Copyright (c) 2018 Pan Ruizhe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

function MaterialIcon({ children }: { children: string }) {
  return <span className="material-icons" aria-hidden="true">{children}</span>;
}

function DemoStage({ lang }: { lang: Lang }) {
  const [mode, setMode] = useState<"motions" | "speakers" | "vote">("motions");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMode((current) => current === "motions" ? "speakers" : current === "speakers" ? "vote" : "motions");
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  const tabs = [
    { id: "motions" as const, label: bi("动议", "Motions"), icon: "gavel" },
    { id: "speakers" as const, label: bi("发言", "Speakers"), icon: "record_voice_over" },
    { id: "vote" as const, label: bi("表决", "Vote"), icon: "how_to_vote" },
  ];

  return (
    <div className="product-stage" aria-label={tx(bi("Console Neo 控制与投影示意", "Console Neo controller and cast preview"), lang)}>
      <div className="stage-controller">
        <div className="stage-titlebar">
          <span>{lang === "zh" ? "海上安全特别会议" : "Maritime Security Session"}</span>
          <span className="stage-live"><i />{lang === "zh" ? "已同步" : "Synced"}</span>
        </div>
        <div className="stage-body">
          <div className="stage-rail" aria-hidden="true">
            {tabs.map((tab) => (
              <button key={tab.id} className={mode === tab.id ? "active" : ""} onClick={() => setMode(tab.id)} title={tx(tab.label, lang)}>
                <MaterialIcon>{tab.icon}</MaterialIcon>
              </button>
            ))}
          </div>
          <div className="stage-view" key={mode}>
            <MaterialIcon>{tabs.find((tab) => tab.id === mode)?.icon || "gavel"}</MaterialIcon>
            {mode === "motions" && (
              <>
                <div className="stage-view-head">
                  <div><small>{lang === "zh" ? "议程" : "Agenda"}</small><strong>{lang === "zh" ? "待处理动议" : "Pending motions"}</strong></div>
                  <div className="stage-metrics"><span><small>{lang === "zh" ? "通过" : "Passed"}</small>6</span><span><small>{lang === "zh" ? "撤回" : "Withdrawn"}</small>1</span></div>
                </div>
                <div className="stage-list">
                  <div className="stage-row passed"><span>{lang === "zh" ? "有主持核心磋商" : "Moderated caucus"}</span><small>{lang === "zh" ? "中国 · 10 分钟" : "China · 10 minutes"}</small><b>{lang === "zh" ? "通过" : "PASSED"}</b></div>
                  <div className="stage-row current"><span>{lang === "zh" ? "实质性表决" : "Substantive vote"}</span><small>{lang === "zh" ? "关联文件 2 份" : "2 linked documents"}</small><b>{lang === "zh" ? "待处理" : "PENDING"}</b></div>
                  <div className="stage-row"><span>{lang === "zh" ? "休会" : "Adjourn meeting"}</span><small>{lang === "zh" ? "挪威" : "Norway"}</small><b>{lang === "zh" ? "待处理" : "PENDING"}</b></div>
                </div>
              </>
            )}
            {mode === "speakers" && (
              <>
                <div className="stage-view-head"><div><small>{lang === "zh" ? "有主持核心磋商" : "Moderated caucus"}</small><strong>{lang === "zh" ? "保障关键航道" : "Securing critical sea lanes"}</strong></div></div>
                <div className="speaker-now"><small>{lang === "zh" ? "正在发言" : "NOW SPEAKING"}</small><strong>{lang === "zh" ? "阿根廷" : "Argentina"}</strong><span>0:42</span></div>
                <div className="speaker-next"><small>{lang === "zh" ? "接下来" : "UP NEXT"}</small><span>{lang === "zh" ? "肯尼亚" : "Kenya"}</span><span>{lang === "zh" ? "挪威" : "Norway"}</span><span>{lang === "zh" ? "新加坡" : "Singapore"}</span></div>
                <div className="speaker-controls" aria-hidden="true"><i>undo</i><i className="primary">pause</i><i>skip_next</i></div>
              </>
            )}
            {mode === "vote" && (
              <>
                <div className="stage-view-head"><div><small>{lang === "zh" ? "实质性表决 · 第 1 轮" : "Substantive vote · Round 1"}</small><strong>{lang === "zh" ? "海上事件降级框架" : "Maritime de-escalation framework"}</strong></div></div>
                <div className="vote-metrics"><span><small>{lang === "zh" ? "赞成" : "For"}</small><b>5</b></span><span><small>{lang === "zh" ? "反对" : "Against"}</small><b>1</b></span><span><small>{lang === "zh" ? "弃权" : "Abstain"}</small><b>1</b></span><span><small>{lang === "zh" ? "过/未投" : "Pass/NV"}</small><b>1</b></span><span className="target"><small>{lang === "zh" ? "门槛" : "Target"}</small><b>5</b></span></div>
                <div className="vote-track"><i style={{ width: "62.5%" }} /></div>
                <div className="vote-result"><MaterialIcon>check_circle</MaterialIcon><span>{lang === "zh" ? "表决通过 · 8 票已核对" : "Vote passed · 8 votes reconciled"}</span></div>
              </>
            )}
          </div>
        </div>
        <div className="stage-footer">
          <span><MaterialIcon>person</MaterialIcon>8 / 10</span>
          <span><small>{lang === "zh" ? "简单多数" : "Simple"}</small>5</span>
          <span><small>{lang === "zh" ? "三分之二" : "Two-thirds"}</small>6</span>
          <span><small>{lang === "zh" ? "五分之一" : "One-fifth"}</small>2</span>
        </div>
      </div>
      <div className="cast-link" aria-hidden="true"><i /><i /><i /></div>
      <div className="stage-cast">
        <div className="cast-brand">Console Neo</div>
        <div className="cast-watermark"><MaterialIcon>{tabs.find((tab) => tab.id === mode)?.icon || "gavel"}</MaterialIcon></div>
        <div className="cast-content" key={`cast-${mode}`}>
          {mode === "motions" && <><small>{lang === "zh" ? "当前议程" : "CURRENT AGENDA"}</small><strong>{lang === "zh" ? "实质性表决" : "Substantive vote"}</strong><span>{lang === "zh" ? "海上事件降级框架" : "Maritime de-escalation framework"}</span></>}
          {mode === "speakers" && <><small>{lang === "zh" ? "正在发言" : "NOW SPEAKING"}</small><strong>{lang === "zh" ? "阿根廷" : "Argentina"}</strong><span className="cast-time">0:42</span></>}
          {mode === "vote" && <><small>{lang === "zh" ? "最终结果" : "FINAL RESULT"}</small><strong className="cast-pass">{lang === "zh" ? "通过" : "PASSED"}</strong><span>5 · 1 · 1 · 1</span></>}
        </div>
        <div className="cast-thresholds"><span>8 / 10</span><span>5</span><span>6</span><span>2</span></div>
      </div>
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const [activeGuide, setActiveGuide] = useState("start");
  const [query, setQuery] = useState("");
  const [licenseCopied, setLicenseCopied] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lang");
    const stored = window.localStorage.getItem("console-neo-site-lang");
    const next: Lang = requested === "en" || requested === "zh"
      ? requested
      : stored === "en" || stored === "zh"
      ? stored
      : window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    const guideId = window.location.hash.startsWith("#docs-")
      ? window.location.hash.slice(6)
      : "";
    const timer = window.setTimeout(() => {
      setLang(next);
      if(guides.some((item) => item.id === guideId)) setActiveGuide(guideId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("console-neo-site-lang", lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if(entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const filteredGuides = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if(!needle) return guides;
    return guides.filter((guide) => {
      const content = [guide.title.zh, guide.title.en, guide.summary.zh, guide.summary.en,
        ...guide.sections.flatMap((section) => [
          section.title.zh, section.title.en, section.intro?.zh || "", section.intro?.en || "",
          ...(section.bullets || []).flatMap((item) => [item.zh, item.en]),
        ])].join(" ").toLocaleLowerCase();
      return content.includes(needle);
    });
  }, [query]);

  const guide = guides.find((item) => item.id === activeGuide) || guides[0];

  const selectGuide = (id: string) => {
    setActiveGuide(id);
    window.history.replaceState(null, "", `#docs-${id}`);
  };

  const changeLanguage = (next: Lang) => {
    setLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  };

  const copyLicense = async () => {
    try {
      await navigator.clipboard.writeText(mitLicense);
      setLicenseCopied(true);
      window.setTimeout(() => setLicenseCopied(false), 1800);
    } catch {
      setLicenseCopied(false);
    }
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Console Neo">
          <Image src="/icon.png" alt="" width={30} height={30} priority />
          <span>Console Neo</span>
        </a>
        <nav aria-label={lang === "zh" ? "主导航" : "Main navigation"}>
          {navigation.map((item) => <a key={item.id} href={`#${item.id}`}>{tx(item.label, lang)}</a>)}
        </nav>
        <div className="language-switch" aria-label={lang === "zh" ? "语言" : "Language"}>
          <button className={lang === "zh" ? "active" : ""} onClick={() => changeLanguage("zh")} lang="zh-CN">中文</button>
          <span>·</span>
          <button className={lang === "en" ? "active" : ""} onClick={() => changeLanguage("en")} lang="en">English</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><i />{lang === "zh" ? "为会场而生的会议控制台" : "A meeting console built for the room"}</div>
          <h1>{lang === "zh" ? <>让每一项议程，<br />清楚地发生。</> : <>Run the room.<br />Keep everyone in sync.</>}</h1>
          <p>{lang === "zh"
            ? "Console Neo 将主席操作、实时协作与会场投影放进一套安静、可靠的流程。让主席专注程序，让与会者始终知道正在发生什么。"
            : "Console Neo brings chairing, live collaboration, and room-facing projection into one calm, reliable flow—so the dais can focus on procedure and everyone else can follow."}</p>
          <div className="hero-actions">
            <a className="selector-link primary-link" href="#docs"><MaterialIcon>menu_book</MaterialIcon><span>{lang === "zh" ? "阅读用户指南" : "Read the user guides"}</span><MaterialIcon>arrow_forward</MaterialIcon></a>
            <a className="selector-link" href="#product"><MaterialIcon>play_circle_outline</MaterialIcon><span>{lang === "zh" ? "了解产品" : "Explore the product"}</span><MaterialIcon>south</MaterialIcon></a>
          </div>
          <p className="availability"><span>{lang === "zh" ? "私有预览" : "Private preview"}</span>{lang === "zh" ? "macOS 通用构建 · Apple 芯片与 Intel" : "macOS Universal · Apple silicon and Intel"}</p>
        </div>
        <DemoStage lang={lang} />
      </section>

      <section className="section product-section" id="product">
        <div className="section-intro reveal">
          <span className="section-index">01</span>
          <div><p className="kicker">{lang === "zh" ? "产品" : "Product"}</p><h2>{lang === "zh" ? "复杂的程序，安静的界面。" : "Complex procedure. A quiet interface."}</h2></div>
          <p>{lang === "zh" ? "没有仪表盘噪音，没有多余装饰。信息按会场节奏出现，操作保留在主席端，结论清楚地交给投影。" : "No dashboard noise and no decorative excess. Information appears at the pace of the room, controls stay with the chair, and outcomes move cleanly to the cast."}</p>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => (
            <article className="feature reveal" key={feature.title.en} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
              <MaterialIcon>{feature.icon}</MaterialIcon><span className="feature-number">0{index + 1}</span>
              <h3>{tx(feature.title, lang)}</h3><p>{tx(feature.body, lang)}</p>
            </article>
          ))}
        </div>
        <div className="product-principles reveal">
          <span>{lang === "zh" ? "主席端" : "Controller"}</span><i />
          <span>{lang === "zh" ? "共享状态" : "Shared state"}</span><i />
          <span>{lang === "zh" ? "会场投影" : "Room cast"}</span>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="section-intro reveal">
          <span className="section-index">02</span>
          <div><p className="kicker">{lang === "zh" ? "工作流程" : "Workflow"}</p><h2>{lang === "zh" ? "从开场到闭会，一条路径。" : "One path, from first roll to adjournment."}</h2></div>
          <p>{lang === "zh" ? "每一步都能独立使用，也能自然衔接下一步。通过动议可直接创建对应名单、计时、文件或表决。" : "Each step stands alone and flows into the next. Passed motions can create the exact list, timer, document, or vote they authorize."}</p>
        </div>
        <div className="workflow-list">
          {workflow.map((step, index) => (
            <article className="workflow-step reveal" key={step.number} style={{ "--delay": `${index * 80}ms` } as React.CSSProperties}>
              <span>{step.number}</span><div><h3>{tx(step.title, lang)}</h3><p>{tx(step.body, lang)}</p></div><MaterialIcon>{index === workflow.length - 1 ? "check" : "arrow_forward"}</MaterialIcon>
            </article>
          ))}
        </div>
      </section>

      <section className="section docs-section" id="docs">
        <div className="section-intro reveal">
          <span className="section-index">03</span>
          <div><p className="kicker">{lang === "zh" ? "用户指南" : "User guides"}</p><h2>{lang === "zh" ? "需要的时候，答案就在这里。" : "The answer, when the room needs it."}</h2></div>
          <p>{lang === "zh" ? "内容按真实会务流程编写，并标明危险操作、角色权限与恢复路径。版本 2.0.0 · 最后核验 2026-08-04。" : "Written around real meeting work, with destructive steps, role boundaries, and recovery paths called out. Version 2.0.0 · last verified 2026-08-04."}</p>
        </div>
        <div className="docs-shell reveal">
          <aside className="docs-sidebar">
            <label className="docs-search">
              <MaterialIcon>search</MaterialIcon>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={lang === "zh" ? "搜索指南" : "Search guides"} aria-label={lang === "zh" ? "搜索指南" : "Search guides"} />
              {query && <button onClick={() => setQuery("")} aria-label={lang === "zh" ? "清除搜索" : "Clear search"}><MaterialIcon>close</MaterialIcon></button>}
            </label>
            <div className="guide-nav">
              {filteredGuides.map((item) => (
                <button key={item.id} className={guide.id === item.id ? "active" : ""} onClick={() => selectGuide(item.id)}>
                  <MaterialIcon>{item.icon}</MaterialIcon><span><strong>{tx(item.title, lang)}</strong><small>{tx(item.summary, lang)}</small></span>
                </button>
              ))}
              {filteredGuides.length === 0 && <p className="no-results">{lang === "zh" ? "没有找到相关指南。" : "No matching guide."}</p>}
            </div>
          </aside>
          <article className="guide-article" key={`${guide.id}-${lang}`}>
            <header>
              <div className="guide-icon"><MaterialIcon>{guide.icon}</MaterialIcon></div>
              <p>{tx(guide.reading, lang)} · {lang === "zh" ? "主席与观察员" : "Chair & Viewer"}</p>
              <h3>{tx(guide.title, lang)}</h3>
              <span>{tx(guide.summary, lang)}</span>
            </header>
            <div className="guide-content">
              {guide.sections.map((section, index) => (
                <section className={section.danger ? "guide-block danger" : "guide-block"} key={`${guide.id}-${index}`}>
                  <div className="guide-block-title"><span>{String(index + 1).padStart(2, "0")}</span><h4>{tx(section.title, lang)}</h4>{section.danger && <MaterialIcon>warning_amber</MaterialIcon>}</div>
                  {section.intro && <p>{tx(section.intro, lang)}</p>}
                  {section.bullets && <ol>{section.bullets.map((bullet, itemIndex) => <li key={itemIndex}><span>{itemIndex + 1}</span><p>{tx(bullet, lang)}</p></li>)}</ol>}
                  {section.note && <div className="guide-note"><MaterialIcon>info_outline</MaterialIcon><p>{tx(section.note, lang)}</p></div>}
                </section>
              ))}
            </div>
            <footer><span>{lang === "zh" ? "本指南有帮助吗？" : "Was this guide useful?"}</span><a href="#top">{lang === "zh" ? "返回顶部" : "Back to top"}<MaterialIcon>north</MaterialIcon></a></footer>
          </article>
        </div>
      </section>

      <section className="section privacy-section" id="privacy">
        <div className="section-intro reveal">
          <span className="section-index">04</span>
          <div><p className="kicker">{lang === "zh" ? "数据与隐私" : "Data & privacy"}</p><h2>{lang === "zh" ? "由主持设备保存，由会话参与者同步。" : "Stored by the host. Shared with the session."}</h2></div>
          <p>{lang === "zh" ? "不做超出实现的隐私承诺。这里清楚说明数据在哪、何时传输，以及主持人应当如何管理访问。" : "No privacy claims beyond the implementation. This is where data lives, when it moves, and what the host must protect."}</p>
        </div>
        <div className="privacy-flow reveal">
          <article><MaterialIcon>laptop_mac</MaterialIcon><small>{lang === "zh" ? "主持设备" : "HOST DEVICE"}</small><h3>{lang === "zh" ? "本地持久化" : "Local persistence"}</h3><p>{lang === "zh" ? "委员会、文件、历史与笔记保存在主持应用的数据目录。" : "Committees, files, history, and notes persist in the host app’s data directory."}</p></article>
          <div className="flow-arrow"><i /><span>{lang === "zh" ? "实时状态" : "live state"}</span></div>
          <article><MaterialIcon>devices</MaterialIcon><small>{lang === "zh" ? "已连接设备" : "CONNECTED DEVICES"}</small><h3>{lang === "zh" ? "按角色同步" : "Role-aware sync"}</h3><p>{lang === "zh" ? "主席可写入；观察员只读。两者都会接收会议实时状态。" : "Chairs can write; Viewers are read-only. Both receive live meeting state."}</p></article>
          <div className="flow-arrow"><i /><span>{lang === "zh" ? "必要时" : "if needed"}</span></div>
          <article><MaterialIcon>cloud_queue</MaterialIcon><small>{lang === "zh" ? "中继" : "RELAY"}</small><h3>{lang === "zh" ? "传输，不存档" : "Transport, not archive"}</h3><p>{lang === "zh" ? "中继帮助跨网络连接；委员会的持久副本仍在主持设备。" : "The relay bridges networks; the durable committee copy remains on the host."}</p></article>
        </div>
        <div className="privacy-rules reveal">
          <div><strong>{lang === "zh" ? "只向需要操作的人提供主席凭据。" : "Give Chair credentials only to people who need to operate."}</strong><span>{lang === "zh" ? "观察与会务支持使用只读验证码。" : "Use the Viewer code for observation and support."}</span></div>
          <div><strong>{lang === "zh" ? "重要会议前后创建离线备份。" : "Create offline backups before and after important sessions."}</strong><span>{lang === "zh" ? "导入会替换全部本地数据，不会合并。" : "Import replaces all local data; it does not merge."}</span></div>
          <div><strong>{lang === "zh" ? "不宣称端到端加密或安全审计。" : "No claim of end-to-end encryption or a security audit."}</strong><span>{lang === "zh" ? "将会话凭据视为敏感访问信息。" : "Treat session credentials as sensitive access information."}</span></div>
        </div>
      </section>

      <section className="section license-section" id="license">
        <div className="section-intro reveal">
          <span className="section-index">05</span>
          <div><p className="kicker">{lang === "zh" ? "授权与致谢" : "License & credits"}</p><h2>{lang === "zh" ? "尊重来处，也为下一步保留选择。" : "Respect the lineage. Keep the next choice deliberate."}</h2></div>
          <p>{lang === "zh" ? "Console Neo 基于 Console Lite 与 Console Lite Edited 的 MIT 许可代码。2016 与 2018 年的原始版权与完整许可必须继续保留。" : "Console Neo includes MIT-licensed work from Console Lite and Console Lite Edited. The original 2016 and 2018 copyrights and full notice must remain."}</p>
        </div>
        <div className="license-layout reveal">
          <div className="license-guidance">
            <div className="recommendation-label"><i />{lang === "zh" ? "当前建议" : "RECOMMENDATION FOR NOW"}</div>
            <h3>{lang === "zh" ? "在权利主体与发布目标明确前，保持私有。" : "Stay private until ownership and release goals are clear."}</h3>
            <p>{lang === "zh" ? "这是最稳妥的当前状态。MIT 允许对继承代码进行私有修改，但未来分发任何包含该代码的版本时，必须保留原始版权与许可文本。" : "That is the cleanest current position. MIT permits private modification of inherited code, but any future distribution containing it must retain the original copyright and license text."}</p>
            <div className="license-options">
              <article><span>01</span><div><strong>{lang === "zh" ? "如果继续私有" : "If staying private"}</strong><p>{lang === "zh" ? "标明仓库与构建为 private；在决定前不要把整体项目宣传为 MIT 或开源。" : "Mark the repository and builds private; do not describe the whole revamp as MIT or open source yet."}</p></div></article>
              <article><span>02</span><div><strong>{lang === "zh" ? "如果选择开放源码" : "If opening the source"}</strong><p>{lang === "zh" ? "继续使用 MIT 最简单，也与上游一致；同时为 2026 年新增工作明确权利主体。" : "MIT is the simplest, upstream-aligned choice; identify the owner of the 2026 work at the same time."}</p></div></article>
              <article><span>03</span><div><strong>{lang === "zh" ? "如果商业闭源分发" : "If distributing proprietary builds"}</strong><p>{lang === "zh" ? "保留上游 MIT 文本，为新增部分制定独立条款，并在发布前取得专业法律意见。" : "Retain upstream MIT text, define separate terms for new work, and obtain professional legal advice before release."}</p></div></article>
            </div>
            <div className="legal-boundary"><MaterialIcon>priority_high</MaterialIcon><p>{lang === "zh" ? "当前根目录 package.json 将整个包标为 MIT，这与“新增代码许可尚未决定”存在边界不清。对外分发前应同步修改软件包元数据、LICENSE/NOTICE 结构与网站说明。此处仅为产品建议，不构成法律意见。" : "The root package.json currently labels the whole package MIT, which conflicts with an undecided license for new work. Before distribution, align package metadata, LICENSE/NOTICE structure, and public copy. This is product guidance, not legal advice."}</p></div>
          </div>
          <div className="license-text">
            <header><div><small>{lang === "zh" ? "继承软件许可" : "INHERITED SOFTWARE LICENSE"}</small><strong>MIT License</strong></div><button onClick={copyLicense}><MaterialIcon>{licenseCopied ? "check" : "content_copy"}</MaterialIcon>{licenseCopied ? (lang === "zh" ? "已复制" : "Copied") : (lang === "zh" ? "复制" : "Copy")}</button></header>
            <pre>{mitLicense}</pre>
            <a href="/LICENSE.txt" target="_blank" rel="noreferrer">{lang === "zh" ? "打开纯文本许可" : "Open plain-text license"}<MaterialIcon>open_in_new</MaterialIcon></a>
          </div>
        </div>
        <div className="credits reveal">
          <div><small>{lang === "zh" ? "项目沿革" : "LINEAGE"}</small><strong>Console Lite → Console Lite Edited → Console Neo</strong></div>
          <div><small>{lang === "zh" ? "原始版权" : "ORIGINAL COPYRIGHT"}</small><strong>© 2016 Liu Xiaoyi · © 2018 Pan Ruizhe</strong></div>
          <div><small>{lang === "zh" ? "当前状态" : "CURRENT STATUS"}</small><strong>{lang === "zh" ? "2026 私有大幅改版 · 新许可待定" : "Private 2026 revamp · new license undecided"}</strong></div>
        </div>
      </section>

      <section className="closing">
        <div className="closing-watermark"><MaterialIcon>present_to_all</MaterialIcon></div>
        <p>{lang === "zh" ? "让程序更顺，让信息更清楚。" : "Calmer procedure. Clearer rooms."}</p>
        <h2>Console Neo</h2>
        <a className="selector-link primary-link" href="#docs"><MaterialIcon>menu_book</MaterialIcon><span>{lang === "zh" ? "打开完整指南" : "Open the full guides"}</span><MaterialIcon>arrow_upward</MaterialIcon></a>
      </section>

      <footer className="site-footer">
        <div className="footer-brand"><Image src="/icon.png" alt="" width={30} height={30} /><span>Console Neo</span><small>2.0.0 · 2026</small></div>
        <p>{lang === "zh" ? "Console Neo 是 Console Lite 与 Console Lite Edited 的私有独立改版。包含 © 2016 Liu Xiaoyi 与 © 2018 Pan Ruizhe 的软件，依 MIT 许可使用。与联合国无隶属或认可关系。" : "Console Neo is a private, independently maintained revamp of Console Lite and Console Lite Edited. Includes software © 2016 Liu Xiaoyi and © 2018 Pan Ruizhe, used under the MIT License. Not affiliated with or endorsed by the United Nations."}</p>
        <div><a href="#license">{lang === "zh" ? "授权" : "License"}</a><a href="#privacy">{lang === "zh" ? "隐私" : "Privacy"}</a><a href="#docs">{lang === "zh" ? "指南" : "Guides"}</a><button onClick={() => changeLanguage(lang === "zh" ? "en" : "zh")}>{lang === "zh" ? "English" : "中文"}</button></div>
      </footer>
    </main>
  );
}
