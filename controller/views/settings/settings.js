// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Zhehan Zhang
// Part of Console Neo. See LICENSE and NOTICE for terms.

const Vue = require('vue');
const fs = require('fs');
const { ipcRenderer } = require('electron');
const reminder = require('../../../shared/reminder');
const source = require('../../../shared/source');

const SettingsView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/settings.html`).toString('utf-8'),
  props: [
    'confTitle',
    'brand',
    'lang',
    'authorized',
    'serverUrl',
    'serverId',
    'serverPasskey',
    'serverReaderkey',
    'serverCode',
    'isLocalServer',
    'syncCast',
    'castFallback',
    'serverReaderCode',
    'relayOk',
    'collabOk',
    'relayStatus',
    'relayUrl',
    'routePref',
    'hostVersion',
  ],

  data: () => ({
    titleInput: '',
    brandInput: '',
    relayUrlInput: '',
    reminderEnabled: true,
    reminderSingle: false,
    rules: [],
    appVersion: source.version,
    attribution: source.ATTRIBUTION,
  }),

  created() {
    this.titleInput = this.confTitle || '';
    this.brandInput = this.brand || '';
    this.relayUrlInput = this.relayUrl || '';
    this.reminderEnabled = reminder.store.enabled;
    this.reminderSingle = reminder.store.single;
    this.rules = reminder.store.rules.map(r => ({
      above: r.above, kind: r.kind || 'before', at: r.at, times: r.times || 1,
    }));
  },

  computed: {
    // Connected to someone else's server: show that host's version and source
    remoteHost() {
      return !!this.serverUrl && !this.isLocalServer;
    },

    /* What identifies the session, and stays on screen even with no
       connectivity - it is still the right thing to read out loud */
    sessionItems() {
      return [
        { label: 'ID', value: this.serverId },
        { label: 'URL', value: this.serverUrl, url: true },
      ];
    },

    /* Rotating code plus long-lived passkey, per role. Only a chair
       sees the chair pair; the codes exist on the hosting machine only */
    chairItems() {
      return [
        { label: this.t('connectCode'), value: this.hostCode(this.serverCode) },
        { label: this.t('chairPassword'), value: this.authorized ? this.serverPasskey : '' },
      ].filter(i => i.value);
    },

    viewerItems() {
      return [
        { label: this.t('connectCode'), value: this.hostCode(this.serverReaderCode) },
        { label: this.t('readerPassword'), value: this.serverReaderkey },
      ].filter(i => i.value);
    },
  },

  watch: {
    confTitle(v) { this.titleInput = v || ''; },
    brand(v) { this.brandInput = v || ''; },
    relayUrl(v) { this.relayUrlInput = v || ''; },
  },

  methods: {
    openAbout() {
      ipcRenderer.send('openAbout');
    },

    openSource() {
      ipcRenderer.send('openSource');
    },

    /* Connect codes are minted by the embedded server and rotate every
       30s, so only the machine hosting it has any to show */
    hostCode(code) {
      return (this.isLocalServer && this.authorized) ? (code || '') : '';
    },

    applyTitle() {
      const name = this.titleInput.trim();
      if(name === '' || name === this.confTitle) return;
      this.$dispatch('rename-conf', name);
    },

    applyBrand() {
      this.$dispatch('set-brand', this.brandInput.trim());
    },

    chooseLang(lang) {
      this.$dispatch('set-lang', lang);
    },

    setEnabled(v) {
      this.reminderEnabled = v;
      this.commitReminder();
    },

    setSync(v) {
      if(v !== this.syncCast) this.$dispatch('set-sync-cast', v);
    },

    setFallback(mode) {
      this.$dispatch('set-cast-fallback', mode);
    },

    switchCommittee() {
      this.$dispatch('switch-committee');
    },

    connectOther() {
      if(!confirm(this.t('connectOtherConfirm'))) return;
      this.$dispatch('disconnect-server');
    },

    resetKeys() {
      this.$dispatch('reset-server-keys');
    },

    checkNetwork() {
      this.$dispatch('check-network');
    },

    setRoute(pref) {
      this.$dispatch('set-route-pref', pref);
    },

    applyRelayUrl() {
      this.$dispatch('set-relay-url', this.relayUrlInput.trim());
    },

    /* Reminder rules */

    addRule() {
      this.rules.push({ above: 60, kind: 'before', at: 10, times: 1 });
      this.commitReminder();
    },

    removeRule(index) {
      this.rules.splice(index, 1);
      this.commitReminder();
    },

    commitReminder() {
      const clean = this.rules
        .map(r => reminder.normalizeRule(r))
        .filter(r => r.kind === 'end' || r.at > 0);
      this.$dispatch('set-reminder', this.reminderEnabled, this.reminderSingle, clean);
    },
  },
});

module.exports = SettingsView;
