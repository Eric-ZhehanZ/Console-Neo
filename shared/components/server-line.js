const Vue = require('vue');
const { clipboard } = require('electron');

/**
 * One labelled line of credentials, e.g.
 *
 *   Chair    Code: ••••  ·  PW: ••••
 *
 * Everything starts redacted; first click reveals, further clicks copy
 * the whole revealed line to the clipboard. Each line keeps its own
 * reveal state, so showing the viewer's credentials to the room does
 * not put the chair's on screen beside them.
 *
 * `items` is a list of { label, value, url } - `url` asks for the
 * host-preserving mask instead of flat dots, since a URL is the one
 * field people need to recognise while it is still covered.
 */
Vue.component('server-line', {
  template:
    '<div class="server-line">' +
    '<span class="server-line-label" v-if="label">{{ label }}</span>' +
    '<span class="server-line-one" @click="click"' +
    ' :title="revealed ? t(\'clickToCopy\') : t(\'clickToReveal\')">' +
    '{{ display }}' +
    '<span class="server-line-copied" v-show="copiedFlag" transition="opacity">' +
    '{{ t(\'copied\') }}</span>' +
    '</span>' +
    '</div>',

  props: ['label', 'items'],

  data: () => ({
    revealed: false,
    copiedFlag: false,
    copiedTimer: null,
  }),

  computed: {
    segments() {
      return (this.items || [])
        .filter(i => i && i.value)
        .map(i => ({
          label: i.label,
          value: i.value,
          masked: i.url ? this.maskUrl(i.value) : '••••',
        }));
    },

    display() {
      return this.segments
        .map(s => `${s.label}: ${this.revealed ? s.value : s.masked}`)
        .join('  ·  ');
    },

    fullLine() {
      return this.segments.map(s => `${s.label}: ${s.value}`).join('  ·  ');
    },
  },

  methods: {
    maskUrl(url) {
      const m = /^(\w+:\/\/)([^:/]+)(:\d+)?/.exec(url);
      if(!m) return '••••';
      return `${m[1]}${m[2].slice(0, 3)}•••••${m[3] || ''}`;
    },

    click() {
      if(!this.revealed) {
        this.revealed = true;
        return;
      }

      clipboard.writeText(this.fullLine);
      this.copiedFlag = true;
      if(this.copiedTimer !== null) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        this.copiedTimer = null;
        this.copiedFlag = false;
      }, 800);
    },
  },
});
