const Vue = require('vue');

/**
 * The two ways another device can reach this session, as a pair of
 * icon buttons in the page's top-right action band:
 *
 *   [wifi | wifi_off]   local network
 *   [cloud | cloud_off] relay
 *
 * The icon itself carries the state rather than opacity alone, so it
 * still reads at a glance on a projector. Clicking one re-checks that
 * transport only - the LAN answer is a free interface enumeration, the
 * relay answer costs a round trip, and there is no reason to spend the
 * round trip when someone only wanted to know about the Wi-Fi.
 */
Vue.component('net-status', {
  template:
    '<div class="net-status">' +
    '<button class="light" :class="{ off: !lanOk, busy: lanChecking }"' +
    ' :title="lanTitle" @click="$dispatch(\'check-lan\')">' +
    '<i class="material-icons">{{ lanIcon }}</i>' +
    '</button>' +
    '<button class="light" :class="{ off: !relayOk, busy: relayChecking }"' +
    ' :title="relayTitle" @click="$dispatch(\'check-relay\')">' +
    '<i class="material-icons">{{ relayIcon }}</i>' +
    '</button>' +
    '</div>',

  props: ['lanOk', 'relayOk', 'lanChecking', 'relayChecking'],

  computed: {
    lanIcon() {
      if(this.lanChecking) return 'sync';
      return this.lanOk ? 'wifi' : 'wifi_off';
    },

    relayIcon() {
      if(this.relayChecking) return 'sync';
      return this.relayOk ? 'cloud' : 'cloud_off';
    },

    lanTitle() {
      if(this.lanChecking) return `${this.t('lanLabel')} — ${this.t('netChecking')}`;
      return `${this.t('lanLabel')} — ${this.t(this.lanOk ? 'netUp' : 'netDown')}`;
    },

    relayTitle() {
      if(this.relayChecking) return `${this.t('relayLabel')} — ${this.t('netChecking')}`;
      return `${this.t('relayLabel')} — ${this.t(this.relayOk ? 'netUp' : 'netDown')}`;
    },
  },
});
