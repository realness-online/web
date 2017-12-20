<template id="profile-as-form">
  <form itemref="profile">
    <profile-as-uid></profile-as-uid>
    <fieldset>
      <label>Email</label>
      <input type="email" v-model='profile.email'>
    </fieldset>

    <fieldset>
      <label>Profile url</label>
      <input type="url"  v-model='profile.slug'>
    </fieldset>

    <fieldset>
      <label>Display name</label>
      <input type="text" v-model='profile.display_name'>
    </fieldset>

    <fieldset>
      <label>Profile image</label>
      <input type="image" v-model='profile.image'>
    </fieldset>

    <fieldset>
      <label>Location</label>
      <input type="zipcode" v-model="profile.zipcode">
    </fieldset>
  </form>
</template>
