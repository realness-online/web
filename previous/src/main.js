import Vue from 'vue'
import VueRouter from 'vue-router'
import * as firebase from 'firebase/app'
import app from '@/components/application'

firebase.initializeApp(process.env.FIREBASE_CONFIG)
Vue.prototype.$bus = new Vue({})
