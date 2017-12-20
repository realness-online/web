<template id="profile-as-locations">
  <nav itemref="profile">
    <a itemprop="website" :href="profile.website">{{profile.website}}</a>
    <a itemprop="email" :href="profile.email">{{profile.email}}</a>
    <a itemprop="phone_number" :href="profile.phone_number">{{profile.phone_number}}</a>
    <a itemprop="city" :href="profile.city">{{city_from_zipcode}}</a>
  </nav>
</template>
