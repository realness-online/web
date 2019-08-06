import date from '@/helpers/date'
export default {
  data() {
    return {
      today: this.created_day(new Date().toISOString())
    }
  },
  methods: {
    created_time(created_at) {
      return date.as_time(created_at)
    },
    created_day(created_at) {
      return date.as_day(created_at)
    },
    created_day_and_time(created_at) {
      return date.as_day_and_time(created_at)
    }
  }
}
