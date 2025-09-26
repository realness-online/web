# Release Plan: vtracer Integration

Before working on these features, do a run through on tests, linting and type checking.

## The Problem

vtracer allowed us to create a cutouts feature which improves the fidelity and animation potential of of our Posters But file size has increase by 300-500% due to the number of cutouts. We need a to store cutouts outside our poster and load them apropriatly.

we'd also like to improve the user experience for poster creation by creating directly in the [posters]('/posters') list.

Decouple poster creation from the UI to allow for multi-file selection and selecting and converting whole folders of images.

## Tasks

### Migration Script (Start Here)

- [ ] Create migration script to download all existing posters
- [ ] Convert single-file posters to folder structure (`index.html.gz`)
- [ ] Upload migrated posters with new folder format
- [ ] Verify migration success and data integrity

### User Experience Improvement

We want to change the user experience around creating posters. Instead of going to an edit screen where we approve each poster, they should be rendered into the posters view with their menus showing up ready to be deleted (but it's assumed they're being kept).

This approach lets us handle multiple files and queues up vtracer conversion, which is much more expensive.

We need to temporarily store the image we're creating and should consider uploading it to the directory to be mixed into the poster.

we then need a way to monitor posters that have vtracer work remaining.

### Cutouts Storage Architecture

We want to store poster from `/users/{phone}/posters/{created_at}.html` to `/users/{phone}/posters/{created_at}/index.html` thereby creating a folder in which we can store the cutouts and on the client the image itself.

We want the filesystem approach to mirror on the client and really need to think about how to do that with our current indexdb and persistance implementation.

### Progressive Loading

We'll load the core poster first (`index.html`) and then load trace segments on-demand. we can be aware of our network latency and toggle between auto loading traces and waiting for the user to click on them. maybe we wait and make people click so that their is this event calendar vibe to viewing posters.

### Randoms

We have an issue with statements not being available on devices where they are created - we need to explore how statement syncing works
