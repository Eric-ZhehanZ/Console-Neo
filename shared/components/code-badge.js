const Vue = require('vue');

/**
 * Join info, as plain stacked text - no card, no chrome:
 *
 *   Session ID          (label)
 *   34B4F2CD-1519
 *   Auth Code           (label)
 *   K7Q4VP              (light privacy blur)
 *   Chair · Viewer  eye (selector + show/hide, under the code)
 *
 * The eye or a click on the code toggles the blur; it re-blurs by
 * itself after two rotations while revealed.
 *
 * With no way to reach any other device the whole auth-code half is
 * swapped out for one gray line saying so, leaving the session ID in
 * place. The two halves cross-fade through .cb-swap, whose height
 * carries the ID upwards as the code appears - the home page anchors
 * the badge by its bottom edge, so growing downwards is really the
 * ID rising.
 */
Vue.component('code-badge', {
  template:
    '<div class="code-badge">' +
    '<div class="cb-label">{{ t(\'sessionIdLabel\') }}</div>' +
    '<div class="cb-id">{{ id }}</div>' +
    '<div class="net-swap" :class="{ online: collabOk !== false }">' +
    '<div class="net-swap-row net-swap-off"><div class="net-swap-inner">' +
    '<div class="cb-offline-text">{{ t(\'needNetworkForCollab\') }}</div>' +
    '</div></div>' +
    '<div class="net-swap-row net-swap-on"><div class="net-swap-inner">' +
    '<div class="cb-label cb-label-gap">{{ t(\'authCode\') }}</div>' +
    '<div class="cb-code" :class="{ flip: flip, blurred: blurred }"' +
    ' @click="toggleBlur">{{ shown }}</div>' +
    '<div class="cb-under">' +
    '<span class="cb-role" :class="{ active: role === \'chair\' }"' +
    ' @click="role = \'chair\'">{{ t(\'roleChair\') }}</span>' +
    '<span class="cb-role-sep">·</span>' +
    '<span class="cb-role" :class="{ active: role === \'reader\' }"' +
    ' @click="role = \'reader\'">{{ t(\'roleViewer\') }}</span>' +
    '<i class="material-icons cb-eye" @click="toggleBlur"' +
    ' :title="blurred ? t(\'revealCode\') : t(\'hideCode\')">' +
    '{{ blurred ? \'visibility\' : \'visibility_off\' }}</i>' +
    '</div>' +
    '</div></div>' +
    '</div>' +
    '</div>',

  props: ['chair', 'readerCode', 'id', 'collabOk'],

  data: () => ({
    role: 'chair',
    flip: false,
    flipTimer: null,
    blurred: true,
    rotationsSinceReveal: 0,
  }),

  computed: {
    shown() {
      return this.role === 'reader' ? (this.readerCode || '') : (this.chair || '');
    },
  },

  methods: {
    toggleBlur() {
      this.blurred = !this.blurred;
      if(!this.blurred) this.rotationsSinceReveal = 0;
    },
  },

  watch: {
    // A code that goes away mid-reveal comes back covered: the network
    // dropping is exactly when a screen is likely to be left unattended
    collabOk(ok) {
      if(!ok) {
        this.blurred = true;
        this.rotationsSinceReveal = 0;
      }
    },

    // Only genuine rotations count towards the auto-blur; switching
    // between the chair and viewer codes never does
    chair() {
      if(this.blurred) return;
      this.rotationsSinceReveal += 1;
      if(this.rotationsSinceReveal >= 2) {
        this.blurred = true;
        this.rotationsSinceReveal = 0;
      }
    },

    shown() {
      this.flip = false;
      if(this.flipTimer !== null) clearTimeout(this.flipTimer);
      // restart the animation on the next frame
      this.$nextTick(() => {
        this.flip = true;
        this.flipTimer = setTimeout(() => {
          this.flip = false;
          this.flipTimer = null;
        }, 320);
      });
    },
  },
});
