const Vue = require('vue');
const fs = require('fs');
const crypto = require('crypto');

const ListView = Vue.extend({
  template: fs.readFileSync(`${__dirname}/list.html`).toString('utf-8'),
  props: [
    'notesMeta',
    'list',
    'seats',
    'altHold',
    'authorized',
    'pinnedLast',
    'delegates',
  ],

  data: () => ({
    addFlag: false,
    editTarget: null,
    editInput: '',
    editHeight: 0,

    acBottomGap: 0,

    dragList: null,

    overlap: null,
    dragging: null,
    dragMode: false,
    dragModeDiscarder: null,
    draggingIndex: -1,
    draggingOriginal: -1,
    draggingCounter: 0,

    editTimerFlag: false,
    totTime: 0,
    eachTime: 0,
    eachLeft: 0,

    nextArmed: true,
    undoSnap: null,

    renaming: false,
    renameInput: '',

    _overrideAdd: false,
    _overrideStart: false,
  }),

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
    hasNote(seat) {
      return Boolean(this.notesMeta && this.notesMeta[`seat:${this.list.id}:${seat.uid}`]);
    },

    noteSeat(seat) {
      this.$dispatch('open-note', `seat:${this.list.id}:${seat.uid}`,
        this.tf('noteSeatTitle', { who: seat.name, name: this.list.name }));
    },

    add(auto) {
      // Only warn when the chair explicitly asks to add while no spot is left;
      // the auto-reopened input after each addition must not nag one spot early.
      if(auto !== true && !this._overrideAdd)
        if(this.spotsLeft !== null && this.spotsLeft <= 0) {
          if(!confirm(this.t('confirmSpotsFull'))) return;
          this._overrideAdd = true;
        }

      this.editInput = '';
      this.addFlag = true;
      this.$nextTick(() => {
        if(this.$els.addItem)
          this.acBottomGap = this.$els.seats.offsetHeight
            - (this.$els.addItem.offsetTop + this.$els.addItem.offsetHeight);
      });
      this.editTarget = null;
    },

    edit(seat, index) {
      if(!this.authorized) return;

      this.editInput = seat.name;
      this.editTarget = seat.uid;

      const wrapper = this.$els.seats.children[index + 1];
      this.acBottomGap = this.$els.seats.offsetHeight - (wrapper.offsetTop + wrapper.offsetHeight);
      // The editor keeps the exact footprint of the row it replaces,
      // so the column layout never reflows while renaming
      this.editHeight = wrapper.offsetHeight;

      this.addFlag = false;
    },

    discardAll() {
      this.addFlag = false;
      this.editTarget = null;
      this.renaming = false;
    },

    performAddition() {
      if(!this.addFlag) return; // guards double commits from blur autosave
      if(this.editInput.length <= 0) {
        // Enter on the empty box finishes the walk-through
        this.discardAll();
        return;
      }
      const seats = [...this.list.seats];
      const newSeat = {
        name: this.editInput,
        uid: crypto.randomBytes(16).toString('hex'),
      };

      // A proposer who chose to speak last stays last as others join.
      // The pin releases once they actually begin speaking: the pointer
      // moved past them, or it sits on them with their timer touched.
      const pinned = this.pinnedLast && this.pinnedLast[this.list.id];
      const lastIdx = seats.length - 1;
      const cur = this.list.timerCurrent;
      const pinnedSpoke = this.list.ptr > lastIdx
        || (this.list.ptr === lastIdx && cur && (cur.active || cur.left < cur.value));
      if(pinned && lastIdx >= 0 && seats[lastIdx].name === pinned && !pinnedSpoke)
        seats.splice(lastIdx, 0, newSeat);
      else seats.push(newSeat);

      this.$dispatch('update-list', this.list, seats);

      this.addFlag = false;

      const watcher = this.$watch('list.seats', () => {
        this.$nextTick(() => watcher());
        // The input closes by itself once every spot is taken; forcing
        // more spots (after the warning) keeps it open as usual
        if(this.spotsLeft !== null && this.spotsLeft <= 0 && !this._overrideAdd)
          this.discardAll();
        else this.add(true);
      });
    },

    /** Whether removing this row can never touch an ongoing/past speech */
    seatRemovable(index) {
      if(index > this.list.ptr) return true;
      if(index === this.list.ptr) {
        const cur = this.list.timerCurrent;
        return !cur || (!cur.active && cur.left === cur.value);
      }
      return false;
    },

    removeSeat(index) {
      const seats = [...this.list.seats];
      if(index < 0 || index >= seats.length) return;
      seats.splice(index, 1);
      this.$dispatch('update-list', this.list, seats);
    },

    /** Backspace in the empty add box eats the newest queued entry */
    backspaceAdd() {
      const seats = [...this.list.seats];
      if(seats.length === 0) return;

      let target = seats.length - 1;
      const pinned = this.pinnedLast && this.pinnedLast[this.list.id];
      if(pinned && seats[target].name === pinned && seats.length > 1) target -= 1;

      if(!this.seatRemovable(target)) return;
      seats.splice(target, 1);
      this.$dispatch('update-list', this.list, seats);
    },

    /** Backspace in an emptied row editor removes it and steps back one */
    backspaceEdit() {
      const uid = this.editTarget;
      if(!uid) return;

      const seats = [...this.list.seats];
      let idx = -1;
      for(let i = 0; i < seats.length; ++i) if(seats[i].uid === uid) {
        idx = i;
        break;
      }
      if(idx === -1) return;

      const prevUid = idx > 0 ? seats[idx - 1].uid : null;
      seats.splice(idx, 1);
      this.editTarget = null;
      this.$dispatch('update-list', this.list, seats);

      if(prevUid) {
        // Reopen on the neighbouring seat once the removal lands
        const watcher = this.$watch('list.seats', () => {
          this.$nextTick(() => watcher());
          this.editSeatByUid(prevUid);
        });
      }
    },

    editSeatByUid(uid) {
      for(let i = 0; i < this.list.seats.length; ++i)
        if(this.list.seats[i].uid === uid) {
          const seat = this.list.seats[i];
          const index = i;
          return void this.$nextTick(() => this.edit(seat, index));
        }
      return undefined;
    },

    /** Enter walks the list: commit, then open the next row for editing */
    commitEditAdvance() {
      const uid = this.editTarget;
      if(!uid) return;

      const seats = this.list.seats;
      let idx = -1;
      for(let i = 0; i < seats.length; ++i) if(seats[i].uid === uid) {
        idx = i;
        break;
      }

      const removing = this.editInput === '';
      const nextUid = (!removing && idx !== -1 && idx + 1 < seats.length)
        ? seats[idx + 1].uid : null;

      this.performEdit();
      if(nextUid) this.editSeatByUid(nextUid);
    },

    performEdit() {
      if(!this.editTarget) return;

      const seats = [...this.list.seats];

      let foundFlag = false;

      for(let i = 0; i < seats.length; ++i)
        if(seats[i].uid === this.editTarget) {
          if(this.editInput === seats[i].name) break;

          foundFlag = true;

          if(this.editInput === '')
            seats.splice(i, 1);
          else {
            const oriSeat = seats[i];
            seats[i] = {
              uid: oriSeat.uid,
              name: this.editInput,
            };
          }

          break;
        }

      this.editTarget = null;

      if(!foundFlag) return;

      this.$dispatch('update-list', this.list, seats);
    },

    /* Dragging */
    dragstart(seat, index, e) {
      e.dataTransfer.setData('text/plain', null);
      this.overlap = seat;
      this.dragging = seat;
      this.draggingIndex = index;
      this.draggingOriginal = index;
      this.draggingCounter = 0;

      if(this.dragModeDiscarder !== null)
        clearInterval(this.dragModeDiscarder);

      this.dragModeDiscarder = null;
      this.dragMode = true;

      this.dragList = [...this.list.seats];
    },

    drag(e) {
      let curMin = Infinity;
      let curIndex = -1;

      if(this.draggingCounter > 0)
        for(let i = 0; i < this.dragList.length; ++i) {
          const elem = this.$els.seats.children[i + 1];
          const centerX = elem.offsetLeft + (elem.offsetWidth / 2);
          const centerY = elem.offsetTop + (elem.offsetHeight / 2);

          // Manhattan distance
          const dist = Math.abs(e.clientX - centerX) + Math.abs(e.clientY - centerY);
          if(dist < curMin) {
            curMin = dist;
            curIndex = i;
          }
        }
      else curIndex = this.draggingOriginal;

      if(curIndex !== -1 && curIndex !== this.draggingIndex) {
        const tmp = this.dragList[this.draggingIndex];
        this.dragList.splice(this.draggingIndex, 1);
        this.dragList.splice(curIndex, 0, tmp);

        this.draggingIndex = curIndex;
      }
    },

    dragend() {
      this.dragging = null;

      this.dragModeDiscarder = setTimeout(() => {
        this.dragModeDiscarder = null;
        this.dragMode = false;
      }, 200);
    },

    dragenter() {
      ++this.draggingCounter;
    },

    dragleave() {
      --this.draggingCounter;
    },

    drop() {
      this.$dispatch('update-list', this.list, this.dragList);
    },

    start() {
      if(!this._overrideStart)
        if(this.list.timerTotal && this.list.timerTotal.value > 0)
          if(this.list.timerCurrent)
            if(this.list.timerCurrent.left > this.list.timerTotal.left) {
              if(!confirm(this.t('confirmStartOverTime'))) return;

              this._overrideStart = true;
            }

      this.$dispatch('start-list', this.list);
    },

    stop() {
      this.$dispatch('stop-list', this.list);
    },

    toggleTimer() {
      const cur = this.list.timerCurrent;
      if(!cur) return;
      if(cur.active) this.stop();
      // A fully elapsed speech cannot restart - next or undo moves on
      else if(cur.left > 0) this.start();
    },

    /* Undo: every pointer move snapshots the speech state first, so an
       accidental press is reversible in one tap - including the
       interrupted speaker's remaining time */

    snapshotUndo() {
      const cur = this.list.timerCurrent;
      this.undoSnap = {
        ptr: this.list.ptr,
        left: cur ? cur.left : null,
        active: cur ? Boolean(cur.active) : false,
      };
    },

    undoStep() {
      if(!this.undoSnap) return;
      const snap = this.undoSnap;
      this.undoSnap = null;
      this.$dispatch('undo-list-step', this.list, snap);
    },

    /** Next with a short cooldown: a double-press cannot skip a speaker */
    nextGuarded() {
      if(!this.nextArmed) return;
      if(!this.list.timerCurrent || this.list.ptr >= this.list.seats.length) return;
      this.nextArmed = false;
      setTimeout(() => {
        this.nextArmed = true;
      }, 700);
      this.snapshotUndo();
      this.next();
    },

    moveSeat(index, delta) {
      const target = index + delta;
      if(target < 0 || target >= this.list.seats.length) return;

      const seats = [...this.list.seats];
      const tmp = seats[index];
      seats[index] = seats[target];
      seats[target] = tmp;

      this.$dispatch('update-list', this.list, seats);
    },

    next() {
      if(this.list.ptr >= this.list.seats.length) return;
      this.$dispatch('iterate-list', this.list, this.list.ptr + 1);
    },

    prev() {
      if(this.list.ptr <= 0) return;
      this.snapshotUndo();
      this.$dispatch('iterate-list', this.list, this.list.ptr - 1);
    },

    editTimer() {
      this.editTimerFlag = true;
      this.eachTime = 0;
      this.totTime = 0;
      this.eachLeft = 0;

      if(this.list.timerCurrent) {
        this.eachTime = this.list.timerCurrent.value;
        this.eachLeft = this.list.timerCurrent.left;
      }

      if(this.list.timerTotal)
        this.totTime = this.list.timerTotal.value;
    },

    performTimerEdit() {
      if(this.eachTime === 0) return;
      const cur = this.list.timerCurrent;
      const valueChanged = !cur || this.eachTime !== cur.value;
      let wantedLeft = null;

      // A configured-value update resets remaining time. When both fields
      // changed, let the controller sequence the two server writes so the
      // remaining-time write cannot be clamped against the old value or be
      // overwritten by the reset.
      if(cur && !cur.active) {
        const wanted = Math.min(this.eachLeft, this.eachTime);
        const resulting = valueChanged ? this.eachTime : cur.left;
        if(wanted !== resulting) wantedLeft = wanted;
      }

      const totalChanged = !this.list.timerTotal
        || this.totTime !== this.list.timerTotal.value;
      if(valueChanged || wantedLeft !== null || totalChanged)
        this.$dispatch('update-list-timers', this.list,
          valueChanged ? this.eachTime : null,
          wantedLeft,
          totalChanged ? this.totTime : null);

      this.editTimerFlag = false;
    },

    project() {
      this.$dispatch('project-list', this.list);
    },

    startRename() {
      if(!this.authorized) return;

      this.renaming = true;
      this.renameInput = this.list.name;

      this.$nextTick(() => {
        const input = this.$el.querySelector('.list-brand-input');
        if(input) {
          this.autosize(input);
          input.focus();
        }
      });
    },

    autosize(el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    },

    onRenameInput(e) {
      this.autosize(e.target);
      this.dispatchRename();
    },

    dispatchRename() {
      if(this._renameDebounce) clearTimeout(this._renameDebounce);
      this._renameDebounce = setTimeout(() => {
        const name = this.renameInput.trim();
        if(name === '' || name === this.list.name) return;

        this.$dispatch('rename-item', 'list', this.list.id, name);
      }, 300);
    },

    remove() {
      const tail = this.t('listTimersDeleted');
      const msg = `${this.t('deleteListConfirm')}「${this.list.name}」? ${tail}`;
      if(!confirm(msg)) return;
      this.$dispatch('remove-item', 'list', this.list.id);
    },
  },

  events: {
    'modal-esc': function modalEsc() {
      this.editTimerFlag = false;
      this.discardAll();
    },
    'modal-submit': function modalSubmit() {
      if(this.addFlag) this.performAddition();
      else if(this.editTarget) this.performEdit();
      else if(this.authorized) this.add();
    },
    'fab-primary': function fabPrimary(key) {
      if(!this.authorized || this.addFlag || this.editTarget) return;
      // Enter adds delegates; Space only starts/pauses the speech -
      // neither key can ever skip a speaker
      if(key === 'Enter') this.add();
      else this.toggleTimer();
    },
    'list-prev': function listPrev() {
      if(this.authorized) this.prev();
    },
    'list-pause': function listPause() {
      if(this.authorized) this.stop();
    },
    'list-playnext': function listPlaynext() {
      if(this.authorized) this.nextGuarded();
    },
  },

  computed: {
    /* Red persists at full elapse - it only drains once next/undo acts */
    playNextAlert() {
      const cur = this.list && this.list.timerCurrent;
      if(!cur) return false;
      if(this.playNextElapsed) return true;
      return this.timerAlertOn(cur);
    },

    playNextElapsed() {
      const cur = this.list && this.list.timerCurrent;
      return Boolean(cur && cur.value > 0 && cur.left === 0);
    },

    queuedNames() {
      if(!this.list || !this.list.seats) return [];
      return this.list.seats.map(s => s.name);
    },

    attachOnTop() {
      return this.acBottomGap < 200;
    },

    presentNames() {
      return (this.seats || []).filter(e => e.present).map(e => e.name);
    },

    /**
     * How many more full speeches fit in the remaining total time.
     * null when the list has no total-time limit.
     */
    spotsLeft() {
      if(!this.list.timerTotal || this.list.timerTotal.value <= 0) return null;
      if(!this.list.timerCurrent || this.list.timerCurrent.value <= 0) return null;

      const each = this.list.timerCurrent.value;
      let avail;
      if(this.list.ptr >= this.list.seats.length)
        avail = this.list.timerTotal.left;
      else {
        const queued = this.list.seats.length - this.list.ptr - 1;
        avail = this.list.timerTotal.left - this.list.timerCurrent.left - (each * queued);
      }

      return Math.max(Math.floor(avail / each), 0);
    },
  },
});

module.exports = ListView;
