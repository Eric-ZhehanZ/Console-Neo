const Vue = require('vue');
const VueAnimatedList = require('vue-animated-list');
Vue.use(VueAnimatedList);

const { ipcRenderer } = require('electron');
const BezierEasing = require('bezier-easing');

const util = require('../shared/util.js');
const motionTypes = require('../shared/motion-types');
const i18n = require('../shared/i18n');
const reminder = require('../shared/reminder');

require('../shared/components/timer.js');

const desc = {
  el: 'body',
  data: {
    ready: false,
    switching: false,
    mode: null,

    connected: false,
    conf: '',
    brand: 'Console Neo',

    seat: 0,
    present: 0,

    timerName: '',
    timerLeft: 0,
    timerValue: 0,
    timerActive: false,

    fileName: '',
    fileType: 'download',
    fileMIME: '',
    fileCont: null,
    fileScrolling: false,
    fileZoom: 1,
    pendingFileData: null,
    pendingLayerTarget: null,

    vote: null,
    voteMat: [],

    list: null,

    motions: [],
    motionDraft: null,
    motionScrollRatio: 0,
    rcSeats: [],

    lang: i18n.store.lang,
  },

  transitions: {
    item: {
      enter(el, done) {
        done();
      },

      leave(el, done) {
        done();
      },
    },
  },

  methods: {
    init() {
      this.ready = true;

      ipcRenderer.on('fromController', (event, data) => {
        console.log(data);
        if(data.type === 'update') this.performUpdate(data);
        else if(data.type === 'reset') this.resetLayer();
        else this.setupLayer(data);
      });

      ipcRenderer.send('projectorInitialized');
    },

    _scrollSmooth(el, to, vertical, duration) {
      const prop = vertical ? 'scrollTop' : 'scrollLeft';
      const dur = duration || 380;
      const current = el[prop];
      const startTime = performance.now();
      const easing = BezierEasing(0.25, 0.1, 0.25, 1.0);

      function step(now) {
        if(now - startTime < dur) {
          const ratio = easing((now - startTime) / dur);
          el[prop] = current + ((to - current) * ratio);
          window.requestAnimationFrame(step);
        } else el[prop] = to;
      }

      window.requestAnimationFrame(step);
    },

    /** Keeps the active speaker's column in view however long the list is */
    _recenterList() {
      const el = this.$els.speakers;
      if(!el || !this.list || !this.list.seats || this.list.seats.length === 0) return;

      let i = this.list.ptr;
      if(i >= this.list.seats.length) i = this.list.seats.length - 1;

      const item = el.children[i];
      if(!item) return;

      const vw = window.innerWidth;
      let left = item.offsetLeft - (0.3 * vw);
      if(left + el.offsetWidth > el.scrollWidth)
        left = el.scrollWidth - el.offsetWidth;
      if(left < 0) left = 0;

      this._scrollSmooth(el, left);
    },

    /** Mirrors the chair's Motions-list position without stacking animations. */
    _scrollMotions(ratio, smooth) {
      this.motionScrollRatio = Math.max(0, Math.min(1, ratio || 0));
      this.$nextTick(() => {
        const el = this.$els.motions;
        if(!el) return;

        const to = this.motionScrollRatio * (el.scrollHeight - el.clientHeight);
        if(this._motionScrollFrame) window.cancelAnimationFrame(this._motionScrollFrame);
        if(!smooth) {
          el.scrollTop = to;
          return;
        }

        const current = el.scrollTop;
        const startTime = performance.now();
        const easing = BezierEasing(0.25, 0.1, 0.25, 1.0);
        const step = (now) => {
          if(now - startTime < 180) {
            const progress = easing((now - startTime) / 180);
            el.scrollTop = current + ((to - current) * progress);
            this._motionScrollFrame = window.requestAnimationFrame(step);
          } else {
            el.scrollTop = to;
            this._motionScrollFrame = null;
          }
        };
        this._motionScrollFrame = window.requestAnimationFrame(step);
      });
    },

    performUpdate({ target, data }) {
      if(target === 'status')
        this.connected = data.connected;
      else if(target === 'seats') {
        this.seat = data.seat;
        this.present = data.present;
      } else if(target === 'title')
        this.conf = data.conf;
      else if(target === 'brand')
        this.brand = data.brand || 'Console Neo';
      else if(target === 'settings') {
        if(data.lang) {
          i18n.setLang(data.lang);
          this.lang = i18n.store.lang;
        }
        if(data.reminder) reminder.apply(data.reminder);
      } else if(target === 'timer') {
        if('name' in data) this.timerName = data.name;
        if('left' in data) this.timerLeft = data.left;
        if('value' in data) this.timerValue = data.value;
        if('active' in data) this.timerActive = data.active;
      } else if(target === 'file') {
        if(this._fileLayerRendering && this.pendingLayerTarget === 'file' && this.pendingFileData) {
          if('scrollRatio' in data) this.pendingFileData.scrollRatio = data.scrollRatio;
          if('zoom' in data) this.pendingFileData.zoom = data.zoom;
          return;
        }

        if('name' in data) this.fileName = data.name;

        if('scrollRatio' in data) {
          const el = this.$els.pages;
          if(el) {
            el.scrollTop = data.scrollRatio * (el.scrollHeight - el.clientHeight);
            this._fileScrolled();
          }
        }

        if('zoom' in data) {
          this.fileZoom = data.zoom;
          if(this.fileType === 'pdf' && this.fileCont) {
            const zoom = this.fileZoom;
            const rendered = document.createElement('div');
            util.renderPDF(this.fileCont, -1, rendered,
              window.innerWidth * 0.8 * zoom).then(() => {
                if(this.fileZoom !== zoom || this.fileType !== 'pdf') return;
                const ratio = this._fileScrollRatio();
                this._replacePages(rendered, ratio);
              });
          }
        }
      } else if(target === 'motions') {
        if('motions' in data) this.motions = data.motions;
        if('draft' in data) this.motionDraft = data.draft;
        if('motions' in data || 'draft' in data || 'scrollRatio' in data)
          this._scrollMotions('scrollRatio' in data ? data.scrollRatio : this.motionScrollRatio,
            'scrollRatio' in data);
      } else if(target === 'rollcall')
        this.rcSeats = data.seats;
      else if(target === 'vote') {
        if(data.event === 'rename')
          this.vote.name = data.name;
        else if(data.event === 'iterate') {
          this.vote.status = data.status;
          this._scrollSmooth(this.$els.voters, 0);
        } else { // update
          this.vote.matrix[data.index].vote = data.vote;

          if(!data.rearrange) { // Running vote
            let i = 0;
            for(; i < this.voteMat.length; ++i)
              if(this.voteMat[i] === this.vote.matrix[data.index])
                break;
            if(i !== this.voteMat.length) {
              const vw = window.innerWidth;
              let left = this.$els.voters.children[i].offsetLeft - (0.3 * vw);
              if(left + this.$els.voters.offsetWidth > this.$els.voters.scrollWidth)
                left = this.$els.voters.scrollWidth - this.$els.voters.offsetWidth;
              if(left < 0) left = 0;

              this._scrollSmooth(this.$els.voters, left);
            }
          }
        }

        if(data.rearrange)
          setTimeout(() => {
            util.sortVoteMatrix(this.voteMat);
          }, 100);
      } else if(target === 'list')
        // Updates that land mid-switch go to the same stash the pending
        // layer setup reads, so none of them are lost
        if(this.switching) this.stashedList = data.list;
        else {
          this.list = data.list;
          if(this.mode === 'list') this.$nextTick(() => this._recenterList());
        }
    },

    setupLayer({ target, data }) {
      if(target === 'list') this.stashedList = data.list;
      const generation = (this._layerGeneration || 0) + 1;
      this._layerGeneration = generation;
      this.pendingLayerTarget = target;
      this.pendingFileData = target === 'file' ? data : null;
      this._fileLayerRendering = target === 'file';

      if(this._switchTimer) clearTimeout(this._switchTimer);

      // Full fade out, swap the layer while invisible, then fade back in
      this.switching = true;
      this._switchTimer = setTimeout(() => {
        const layerData = target === 'file' ? this.pendingFileData : data;
        this._setupLayer(target, layerData, generation).then(() => {
          if(this._layerGeneration !== generation) return;
          this.$nextTick(() => {
            if(this._layerGeneration !== generation) return;
            this.switching = false;
            this.pendingLayerTarget = null;
            this.pendingFileData = null;
          });
        });
      }, 240);
    },

    _setupLayer(target, data, generation) {
      this.mode = target;

      if(target === 'timer') {
        if('name' in data) this.timerName = data.name;
        if('left' in data) this.timerLeft = data.left;
        if('value' in data) this.timerValue = data.value;
        if('active' in data) this.timerActive = data.active;
      } else if(target === 'file') {
        this.fileName = data.meta.name;
        this.fileCont = data.content;
        this.fileMIME = data.meta.type;
        this.fileType = util.getFileType(data.meta.type);
        this.fileZoom = typeof data.zoom === 'number'
          ? Math.max(0.5, Math.min(3, data.zoom)) : 1;
        this.fileScrolling = false;

        if(this.fileType === 'pdf') {
          this.clearPages();
          const renderLatest = () => {
            const zoom = typeof data.zoom === 'number'
              ? Math.max(0.5, Math.min(3, data.zoom)) : 1;
            this.fileZoom = zoom;
            const rendered = document.createElement('div');
            return util.renderPDF(this.fileCont, -1, rendered,
              window.innerWidth * 0.8 * zoom).then(() => {
                // A newer layer supersedes this asynchronous PDF render.
                if(this._layerGeneration !== generation) return null;
                const latestZoom = typeof data.zoom === 'number'
                  ? Math.max(0.5, Math.min(3, data.zoom)) : 1;
                // A zoom update can arrive while a large PDF is rendering.
                // Discard that obsolete render and commit only the latest size.
                if(latestZoom !== zoom) return renderLatest();

                const ratio = typeof data.scrollRatio === 'number'
                  ? Math.max(0, Math.min(1, data.scrollRatio)) : 0;
                this._replacePages(rendered, ratio);
                this._fileLayerRendering = false;
                return null;
              });
          };
          return renderLatest();
        } else if(this.fileType === 'image') {
          // Does nothing
        }
        this._fileLayerRendering = false;
      } else if(target === 'vote') {
        this.vote = data.vote;

        // Setup mat
        this.voteMat = [...this.vote.matrix];

        // Sort anyway
        util.sortVoteMatrix(this.voteMat);
      } else if(target === 'list') {
        // Using stashed list
        this.list = this.stashedList;
        this.$nextTick(() => this._recenterList());
      } else if(target === 'motions') {
        this.motions = data.motions;
        this.motionDraft = null;
        this._scrollMotions(data.scrollRatio || 0, false);
      } else if(target === 'rollcall')
        this.rcSeats = data.seats;

      return Promise.resolve();
    },

    resetLayer() {
      this.connected = false;
      this.brand = 'Console Neo';
      this.setupLayer({ target: null });
    },

    clearPages() {
      while(this.$els.pages.firstChild)
        this.$els.pages.removeChild(this.$els.pages.firstChild);
      this.$els.pages.scrollTop = 0;
    },

    _fileScrollRatio() {
      const el = this.$els.pages;
      if(!el) return 0;
      const range = el.scrollHeight - el.clientHeight;
      return range > 0 ? el.scrollTop / range : 0;
    },

    _replacePages(rendered, ratio) {
      this.clearPages();
      while(rendered.firstChild)
        this.$els.pages.appendChild(rendered.firstChild);
      const range = this.$els.pages.scrollHeight - this.$els.pages.clientHeight;
      this.$els.pages.scrollTop = ratio * Math.max(range, 0);
    },

    _fileScrolled() {
      this.fileScrolling = true;
      if(this._fileScrollTimer) clearTimeout(this._fileScrollTimer);
      this._fileScrollTimer = setTimeout(() => {
        this.fileScrolling = false;
      }, 1200);
    },

    voteCount(status) {
      return this.vote ?
        this.vote.matrix.reduce((prev, e) => e.vote === status ? prev + 1 : prev, 0)
        : 0;
    },

    motionCount(outcome) {
      return this.motions.reduce((prev, e) => e.outcome === outcome ? prev + 1 : prev, 0);
    },

    displayName(motion) {
      if(motionTypes.isDefaultName(motion, i18n.DICT))
        return this.t(motionTypes.labelKey(motion.type));
      return motion.name;
    },

    typeLabel(key) {
      if(!key) return '';
      const lk = motionTypes.labelKey(key);
      return lk ? this.t(lk) : motionTypes.label(key);
    },

    motionTimerInfo(m) {
      const p = m.params || {};
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      const fmt = t => `${Math.floor(t / 60)}:${pad(t % 60)}`;
      const parts = [];
      if(p.totTime) parts.push(fmt(p.totTime));
      if(p.eachTime) parts.push(`${fmt(p.eachTime)}${this.t('perPersonSuffix')}`);
      return parts.join(' · ');
    },

    motionDocInfo(m) {
      const p = m.params || {};
      return p.fileNames && p.fileNames.length > 0 ? p.fileNames.join('、') : '';
    },

    motionClock(m) {
      const d = new Date(m.time);
      const pad = n => (n < 10 ? `0${n}` : `${n}`);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    outcomeText(outcome) {
      const keys = {
        pending: 'outcomePending',
        passed: 'outcomePassed',
        failed: 'outcomeFailed',
        withdrawn: 'outcomeWithdrawn',
      };
      return this.t(keys[outcome] || outcome);
    },
  },

  computed: {
    /* Single-element arrays drive the animated speaker swap: when the
       name changes, the old element leaves while the new one enters */
    currentSpeakerName() {
      if(!this.list || this.list.ptr >= this.list.seats.length) return [];
      return [this.list.seats[this.list.ptr].name];
    },

    nextSpeakerName() {
      if(!this.list || this.list.ptr >= this.list.seats.length - 1) return [];
      return [this.list.seats[this.list.ptr + 1].name];
    },

    rcPresent() {
      return this.rcSeats.reduce((prev, e) => e.present ? prev + 1 : prev, 0);
    },

    simpleHalfCount() {
      return Math.floor(this.present / 2) + 1;
    },

    twoThirdCount() {
      return Math.ceil(this.present * 2 / 3);
    },

    twentyPercentCount() {
      return Math.ceil(this.present / 5);
    },

    timerProgressOffset() {
      if(this.timerValue === 0) return 'translateX(-0)';
      else return `translateX(-${100 - (100 * this.timerLeft / this.timerValue)}%)`;
    },

    shortName() {
      return this.fileName.split('.')[0];
    },

    imgRendered() {
      const blob = new Blob([this.fileCont], { type: this.fileType });
      return URL.createObjectURL(blob);
    },

    fileTwoThird() {
      if(!this.vote) return 0;
      else return Math.ceil((this.vote.matrix.length - this.voteCount(-1)) * 2 / 3);
    },

    abstainedCount() {
      return this.voteCount(-1);
    },

    passOrNoVoteCount() {
      return this.voteCount(0);
    },

    voteRoundComplete() {
      return Boolean(this.vote && this.vote.status
        && this.vote.status.iteration > 0 && !this.vote.status.running);
    },

    positiveCount() {
      return this.voteCount(1);
    },

    negativeCount() {
      return this.voteCount(-2);
    },

    abstainedProgressOffset() {
      return `translateX(${100 - (100 * this.abstainedCount / this.vote.matrix.length)}%)`;
    },

    negativeProgressOffset() {
      const percentage = 100 * (this.negativeCount + this.abstainedCount) / this.vote.matrix.length;
      return `translateX(${100 - percentage}%)`;
    },

    positiveProgressOffset() {
      return `translateX(-${100 - (100 * this.positiveCount / this.vote.matrix.length)}%)`;
    },

    targetOffset() {
      const _target = this.vote.target > 0 ? this.vote.target : this.fileTwoThird;
      return `translateX(${50 * _target / this.vote.matrix.length}vw)`;
    },
  },
};

// eslint-disable-next-line no-unused-vars
function setup() {
  const instance = new Vue(desc);
  instance.init();
}
