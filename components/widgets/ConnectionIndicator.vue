<template>
  <div v-if="icon" class="flex h-full items-center px-1">
    <button
      type="button"
      :aria-label="icon"
      class="flex items-center gap-1 px-2 py-0.5 rounded-md-full bg-md-surface-2 transition-md-standard"
      @click="showAlertDialog"
    >
      <span class="material-symbols text-base leading-none" :class="iconClass">{{ icon }}</span>
    </button>
  </div>
</template>

<script>
import { Dialog } from '@capacitor/dialog'

export default {
  data() {
    return {}
  },
  computed: {
    user() {
      return this.$store.state.user.user
    },
    socketConnected() {
      return this.$store.state.socketConnected
    },
    serverReachable() {
      return this.$store.state.serverReachable
    },
    networkConnected() {
      return this.$store.state.networkConnected
    },
    networkConnectionType() {
      return this.$store.state.networkConnectionType
    },
    isNetworkUnmetered() {
      return this.$store.state.isNetworkUnmetered
    },
    isCellular() {
      return this.networkConnectionType === 'cellular'
    },
    attemptingConnection() {
      return this.$store.state.attemptingConnection
    },
    icon() {
      if (!this.user && !this.attemptingConnection) return null // hide when not connected to server

      if (this.attemptingConnection) {
        return 'cloud_sync'
      } else if (!this.networkConnected) {
        return 'wifi_off'
      } else if (!this.socketConnected || !this.serverReachable) {
        return 'cloud_off'
      } else if (this.isCellular) {
        return 'signal_cellular_alt'
      } else {
        return 'cloud_done'
      }
    },
    iconClass() {
      if (!this.networkConnected) return 'text-md-error'
      else if (!this.socketConnected || !this.serverReachable) return 'text-md-error'
      else if (!this.isNetworkUnmetered) return 'text-warning'
      else if (this.isCellular) return 'text-md-on-surface-variant'
      else return 'text-success'
    }
  },
  methods: {
    showAlertDialog() {
      var msg = ''
      if (this.attemptingConnection) {
        msg = this.$strings.MessageAttemptingServerConnection
      } else if (!this.networkConnected) {
        msg = this.$strings.MessageNoNetworkConnection
      } else if (!this.socketConnected) {
        msg = this.$strings.MessageSocketNotConnected
      } else if (!this.serverReachable) {
        msg = this.$strings.MessageServerConnectionUnavailable
      } else if (this.isCellular) {
        msg = this.isNetworkUnmetered ? this.$strings.MessageSocketConnectedOverUnmeteredCellular : this.$strings.MessageSocketConnectedOverMeteredCellular
      } else {
        msg = this.isNetworkUnmetered ? this.$strings.MessageSocketConnectedOverUnmeteredWifi : this.$strings.MessageSocketConnectedOverMeteredWifi
      }
      Dialog.alert({
        title: this.$strings.HeaderConnectionStatus,
        message: msg
      })
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
