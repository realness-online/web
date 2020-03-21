import date_helper from '@/helpers/date'
export default {
  data () {
    return {
      today: this.as_day(new Date().toISOString())
    }
  },
  methods: {
    as_day (iso_string) {
      return date_helper.as_day(iso_string)
    },
    as_time (iso_string) {
      return date_helper.as_time(iso_string)
    },
    as_day_and_time (iso_string) {
      return date_helper.as_day_and_time(iso_string)
    }
  }
}
