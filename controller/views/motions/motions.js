const Vue = require('vue');
const fs = require('fs');
const motionTypes = require('../../../shared/motion-types');
const i18n = require('../../../shared/i18n');

const OUTCOME_KEY = {
  pending: 'outcomePending',
  passed: 'outcomePassed',
  failed: 'outcomeFailed',
  withdrawn: 'outcomeWithdrawn',
};

const MotionsView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/motions.html`).toString('utf-8'),
  props: [
    'notesMeta',
    'motionsSort',
    'motionsFilter',
    'motionsFilterHidden',
    'motions',
    'seats',
    'files',
    'authorized',
    'delegates',
    {
      name: 'searchInput',
      default: '',
    },
  ],

  data: () => ({
    addFlag: false,
    inputType: 'mod',
    inputProposer: '',
    inputTopic: '',
    inputComment: '',
    totTime: 0,
    eachTime: 0,
    inputFileIds: [],
    outcomes: ['pending', 'passed', 'failed', 'withdrawn'],
    types: motionTypes.TYPES,

    editMotionId: null,
  }),

  watch: {
    inputProposer() {
      this.pushDraft();
    },

    inputTopic() {
      this.pushDraft();
    },

    inputComment() {
      this.pushDraft();
    },

    totTime() {
      this.pushDraft();
    },

    eachTime() {
      this.pushDraft();
    },

    inputFileIds() {
      this.pushDraft();
    },
  },

  activate(done) {
    this.$nextTick(() => {
      this.syncMotionScroll(this.$els.motionScroll);
      done();
    });
  },

  methods: {
    hasNote(key) {
      return Boolean(this.notesMeta && this.notesMeta[key]);
    },

    /* Default-label names (e.g. Suspend Meeting) follow the UI language */
    displayName(motion) {
      if(motionTypes.isDefaultName(motion, i18n.DICT))
        return this.t(motionTypes.get(motion.type).labelKey);
      return motion.name;
    },

    note(item) {
      this.$dispatch('open-note', `motion:${item.id}`,
        this.tf('noteMotionTitle', { who: item.proposer, name: item.name }));
    },

    cycleSort() {
      this.$dispatch('set-motions-opts',
        this.motionsSort === 'chrono' ? 'disruptive' : 'chrono', this.motionsFilter);
    },

    cycleFilter() {
      this.$dispatch('set-motions-opts',
        this.motionsSort, this.motionsFilter === 'custom' ? 'pending' : 'custom');
    },

    motionListScrolled(e) {
      if(this._motionScrollThrottle) return;
      this._motionScrollThrottle = setTimeout(() => {
        this._motionScrollThrottle = null;
        this.syncMotionScroll(e.target);
      }, 80);
    },

    syncMotionScroll(el) {
      if(!el) return;
      const range = el.scrollHeight - el.clientHeight;
      this.$dispatch('motion-scroll', range > 0 ? el.scrollTop / range : 0);
    },

    add() {
      this.editMotionId = null;
      this.addFlag = true;
      this.inputType = 'mod';
      this.inputProposer = '';
      this.inputTopic = '';
      this.inputComment = '';
      this.totTime = 0;
      this.eachTime = 0;
      this.inputFileIds = [];
      this.pushDraft();
    },

    /* Reuse the create modal to edit an existing motion */
    openEdit(motion) {
      this.editMotionId = motion.id;
      this.addFlag = true;
      this.inputType = motion.type || 'other';

      const p = motion.params || {};
      // topic/title motions store the text as the name; others keep name as label
      this.inputTopic = (this.hasField('topic') || this.hasField('title')) ? motion.name : '';
      this.inputProposer = motion.proposer;
      this.inputComment = p.comment || '';
      this.totTime = p.totTime || 0;
      this.eachTime = p.eachTime || 0;
      this.inputFileIds = (p.fileIds || (p.fileId ? [p.fileId] : [])).slice();
    },

    discardAddition() {
      this.addFlag = false;
      this.editMotionId = null;
      this.$dispatch('sync-motion-draft', null);
    },

    onTypeChange() {
      this.inputFileIds = [];

      // Prolonging: preload the previous caucus' time setup
      if(this.inputType === 'prolong' && this.prolongBase) {
        const bp = this.prolongBase.params || {};
        this.totTime = bp.totTime || 0;
        this.eachTime = bp.eachTime || 0;
      }

      this.pushDraft();
    },

    hasField(field) {
      // The prolong form mirrors whatever the previous caucus was
      if(this.inputType === 'prolong' && (field === 'totTime' || field === 'eachTime')) {
        if(!this.prolongBase) return field === 'totTime';
        return motionTypes.hasField(this.prolongBase.type, field);
      }
      return motionTypes.hasField(this.inputType, field);
    },

    typeLabel(key) {
      const lk = motionTypes.labelKey(key);
      return lk ? this.t(lk) : motionTypes.label(key);
    },

    executable(motion) {
      return motionTypes.get(motion.type).action !== null;
    },

    actionIcon(motion) {
      const icons = {
        list: 'record_voice_over',
        tour: 'record_voice_over',
        timer: 'timer',
        prolong: 'timer',
        file: 'folder',
        pvote: 'thumbs_up_down',
        svote: 'thumbs_up_down',
      };
      if(motion.type === 'prolong') return 'record_voice_over';
      return icons[motionTypes.get(motion.type).action] || 'arrow_forward';
    },

    shortcut(motion) {
      this.$dispatch('execute-motion', motion);
    },

    formatDuration(t) {
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      const m = Math.floor(t / 60);
      const s = t % 60;
      return `${m}:${pad(s)}`;
    },

    timerInfo(motion) {
      const p = motion.params || {};
      const parts = [];
      if(p.totTime) parts.push(this.formatDuration(p.totTime));
      if(p.eachTime) parts.push(`${this.formatDuration(p.eachTime)}${this.t('perPersonSuffix')}`);
      return parts.join(' · ');
    },

    docInfo(motion) {
      const p = motion.params || {};
      if(p.fileNames && p.fileNames.length > 0) return p.fileNames.join(' · ');

      const ids = p.fileIds || (p.fileId ? [p.fileId] : []);
      if(ids.length === 0) return '';
      return this.files
        .filter(f => ids.indexOf(f.id) !== -1)
        .map(f => f.name)
        .join(' · ');
    },

    composedName() {
      const t = motionTypes.get(this.inputType);
      const text = this.inputTopic.trim();

      if(this.inputType === 'prolong')
        return text !== '' ? text : this.prolongDefault;

      if(t.fields.indexOf('topic') === -1 && t.fields.indexOf('title') === -1)
        return this.t(t.labelKey);
      // Optional-topic motions default to the type's own (translated) label
      if(text === '' && this.topicOptional) return this.t(t.labelKey);
      return text;
    },


    performAddition() {
      const name = this.composedName();
      const proposer = this.inputProposer.trim();
      if(name === '' || proposer === '') return;

      if(this.inputType === 'mod' && this.eachTime <= 0) return;
      if(this.inputType === 'tour' && this.eachTime <= 0) return;
      const timed = ['unmod', 'cow', 'pause', 'free'];
      if(timed.indexOf(this.inputType) !== -1 && this.totTime <= 0) return;
      if(this.inputType === 'prolong') {
        if(this.hasField('eachTime') && this.eachTime <= 0) return;
        if(this.hasField('totTime') && !this.hasField('eachTime') && this.totTime <= 0) return;
      }
      if(this.inputType === 'doc' && this.inputFileIds.length === 0) return;

      const params = {};
      if(this.inputType === 'prolong' && this.prolongBase) {
        params.baseId = this.prolongBase.id;
        params.baseType = this.prolongBase.type;
        params.baseName = this.prolongBase.name;
      }
      if(this.hasField('topic')) params.topic = name;
      if(this.hasField('comment') && this.inputComment.trim() !== '')
        params.comment = this.inputComment.trim();
      if(this.hasField('totTime')) params.totTime = this.totTime;
      if(this.hasField('eachTime')) params.eachTime = this.eachTime;
      if(this.hasField('file')) params.fileId = this.inputFileIds[0];
      if(this.hasField('files')) params.fileIds = this.inputFileIds;
      if(this.inputFileIds.length > 0)
        params.fileNames = this.files
          .filter(f => this.inputFileIds.indexOf(f.id) !== -1)
          .map(f => f.name);

      if(this.editMotionId) {
        this.$dispatch('edit-motion', this.editMotionId, name, proposer, this.inputType, params);
        this.$dispatch('sync-motion-draft', null);
      } else {
        // The draft stays on the cast until the real motion arrives, so the
        // row morphs into pending instead of vanishing and re-entering
        this.$dispatch('add-motion', name, proposer, this.inputType, params);
      }

      this.addFlag = false;
      this.editMotionId = null;
    },

    /* File association */

    fileSelected(id) {
      return this.inputFileIds.indexOf(id) !== -1;
    },

    toggleFile(id) {
      if(this.hasField('files')) {
        const idx = this.inputFileIds.indexOf(id);
        if(idx === -1) this.inputFileIds.push(id);
        else this.inputFileIds.splice(idx, 1);
      } else this.inputFileIds = this.fileSelected(id) ? [] : [id];
    },

    /* Cast draft sync: always streams while the modal is open */

    pushDraft() {
      // Only stream a draft while creating; editing updates the live motion on submit
      if(!this.addFlag || this.editMotionId) return;

      if(this._draftDebounce) clearTimeout(this._draftDebounce);
      this._draftDebounce = setTimeout(() => {
        const name = this.composedName();
        const params = {};
        if(this.hasField('totTime') && this.totTime > 0) params.totTime = this.totTime;
        if(this.hasField('eachTime') && this.eachTime > 0) params.eachTime = this.eachTime;
        if(this.inputFileIds.length > 0)
          params.fileNames = this.files
            .filter(f => this.inputFileIds.indexOf(f.id) !== -1)
            .map(f => f.name);
        if(this.hasField('comment') && this.inputComment.trim() !== '')
          params.comment = this.inputComment.trim();

        this.$dispatch('sync-motion-draft', {
          name: name || '……',
          proposer: this.inputProposer.trim() || '……',
          type: this.inputType,
          typeLabel: this.typeLabel(this.inputType),
          params,
        });
      }, 150);
    },

    /* Row actions */

    execute(motion) {
      this.$dispatch('execute-motion', motion);
    },

    toggleVisible(motion) {
      this.$dispatch('toggle-motion-visible', motion);
    },

    remove(motion) {
      if(!confirm(`${this.t('deleteMotionConfirm')}「${motion.name}」?`)) return;
      this.$dispatch('remove-item', 'motion', motion.id);
    },

    setOutcome(motion, outcome) {
      if(!this.authorized) return;
      if(motion.outcome === outcome) return;

      this.$dispatch('update-motion', motion.id, outcome);
    },

    outcomeText(outcome) {
      return this.t(OUTCOME_KEY[outcome] || outcome);
    },

    formatTime(time) {
      const d = new Date(time);
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
  },

  events: {
    'modal-esc': function modalEsc() {
      if(this.addFlag) this.discardAddition();
    },
    'modal-submit': function modalSubmit() {
      if(this.addFlag) this.performAddition();
    },
    'fab-primary': function fabPrimary() {
      if(this.authorized && !this.addFlag) this.add();
    },
  },

  computed: {
    /* Whether the topic/title may stay empty for the selected type */
    topicOptional() {
      return ['unmod', 'cow', 'free', 'pause', 'open', 'suspend', 'prolong']
        .indexOf(this.inputType) !== -1;
    },

    prolongDefault() {
      return this.prolongBase
        ? `${this.t('prolongNamePrefix')}${this.prolongBase.name}`
        : this.t('mtProlong');
    },

    topicPlaceholder() {
      if(!this.topicOptional) return '';
      if(this.inputType === 'prolong') return this.prolongDefault;
      return this.t(motionTypes.get(this.inputType).labelKey);
    },

    shownMotions() {
      let out = this.motions;
      if(this.motionsFilter === 'pending')
        out = out.filter(m => (this.motionsFilterHidden || []).indexOf(m.id) === -1);
      if(this.motionsSort === 'disruptive')
        out = out.slice().sort(motionTypes.compareDisruptive);
      return out;
    },

    prolongBase() {
      for(const m of this.motions)
        if(m.executed && ['mod', 'unmod', 'cow', 'tour'].indexOf(m.type) !== -1) return m;
      return null;
    },

    presentSeats() {
      return this.seats.filter(e => e.present).map(e => e.name);
    },
  },
});

module.exports = MotionsView;
