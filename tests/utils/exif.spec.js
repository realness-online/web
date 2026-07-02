import { describe, it, expect } from 'vite-plus/test'
import {
  extract_poster_exif,
  read_poster_exif,
  write_poster_exif,
  POSTER_EXIF_FIELDS
} from '@/utils/exif'

const itemid = '/+16282281824/posters/1576588885385'

const make_poster = () => {
  const fragment = document
    .createRange()
    .createContextualFragment(
      `<svg itemscope itemtype="/posters" itemid="${itemid}" viewBox="0 0 10 10"></svg>`
    )
  return fragment.querySelector('[itemid]')
}

describe('@/utils/exif', () => {
  it('extracts context and viewpoint fields from expanded ExifReader tags', () => {
    const exif = extract_poster_exif({
      exif: {
        DateTimeOriginal: { value: '2024:06:27 14:30:00' },
        SubSecTimeOriginal: { value: '847' },
        OffsetTimeOriginal: { value: '-07:00' },
        Make: { value: 'Apple' },
        Model: { value: 'iPhone 15 Pro' },
        LensModel: { value: 'iPhone 15 Pro back triple camera 6.86mm f/1.78' },
        ExposureTime: { value: '1/120' },
        FNumber: { value: [178, 100] },
        ISO: { value: 64 },
        FocalLength: { value: [686, 100] },
        FocalLengthIn35mmFilm: { value: 24 },
        DigitalZoomRatio: { value: [15, 10] },
        Orientation: { value: 1 },
        Flash: { value: 16, description: 'Flash did not fire, auto mode' },
        ExposureProgram: { value: 2, description: 'Normal program' },
        WhiteBalance: { value: 0, description: 'Auto white balance' },
        SceneCaptureType: { value: 0, description: 'Standard' },
        SubjectDistanceRange: { value: 2, description: 'Close view' },
        SubjectDistance: { value: [250, 100] },
        SubjectArea: { value: [120, 80, 40, 30] },
        SubjectLocation: { value: [512, 384] },
        GPSImgDirection: { value: [245, 1] },
        GPSHPositioningError: { value: [5, 1] },
        GPSDestBearing: { value: [250, 1] },
        GPSDestDistance: { value: [1200, 1] },
        GPSSpeed: { value: [5, 1] },
        GPSTrack: { value: [90, 1] },
        GPSDateStamp: { value: '2024:06:27' },
        GPSTimeStamp: {
          value: [
            [14, 1],
            [30, 1],
            [0, 1]
          ],
          description: '14:30:00'
        },
        UserComment: { description: 'Corner of 24th and Mission' },
        ImageDescription: { value: 'Street scene' },
        ImageUniqueID: { value: 'abc123unique' }
      },
      iptc: {
        City: { value: 'San Francisco' },
        'Province-State': { value: 'California' },
        'Country/Primary Location Name': { value: 'USA' },
        'Content Location Name': { value: 'Mission District' },
        Keywords: { description: 'street, mural, morning' },
        'Caption/Abstract': { description: 'Morning light on the mural wall' }
      },
      gps: { Latitude: 37.7749, Longitude: -122.4194, Altitude: 12.5 }
    })

    expect(exif).toEqual({
      dateCreated: '2024:06:27 14:30:00',
      subSecTimeOriginal: '847',
      offsetTimeOriginal: '-07:00',
      camera: 'Apple iPhone 15 Pro',
      lens: 'iPhone 15 Pro back triple camera 6.86mm f/1.78',
      exposureTime: '1/120',
      fNumber: '1.78',
      iso: '64',
      focalLength: '6.86',
      focalLength35mm: 24,
      digitalZoomRatio: 1.5,
      orientation: '1',
      flash: 'Flash did not fire, auto mode',
      exposureProgram: 'Normal program',
      whiteBalance: 'Auto white balance',
      sceneCaptureType: 'Standard',
      subjectDistanceRange: 'Close view',
      subjectDistance: 2.5,
      subjectArea: '120,80,40,30',
      subjectLocation: '512,384',
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 12.5,
      imgDirection: 245,
      destBearing: 250,
      destDistance: 1200,
      gpsSpeed: 5,
      gpsTrack: 90,
      gpsDateStamp: '2024:06:27',
      gpsTimeStamp: '14:30:00',
      gpsAccuracy: 5,
      placeName: 'Mission District, San Francisco, California, USA',
      keywords: 'street, mural, morning',
      caption: 'Morning light on the mural wall',
      userComment: 'Corner of 24th and Mission',
      imageDescription: 'Street scene',
      imageUniqueId: 'abc123unique'
    })
  })

  it('reads flat tags when expanded groups are absent', () => {
    const exif = extract_poster_exif({
      DateTimeOriginal: { value: '2024:01:01 00:00:00' },
      Make: { value: 'Canon' },
      Model: { value: 'R5' },
      gps: { Latitude: 40.7, Longitude: -74.0 }
    })

    expect(exif?.camera).toBe('Canon R5')
    expect(exif?.latitude).toBe(40.7)
  })

  it('returns null when no relevant tags are present', () => {
    expect(extract_poster_exif({})).toBeNull()
  })

  it('round-trips all poster EXIF fields through index markup', () => {
    /** @type {import('@/utils/exif.js').PosterExif} */
    const sample = {
      dateCreated: '2024-06-27T14:30:00',
      subSecTimeOriginal: '847',
      offsetTimeOriginal: '-07:00',
      camera: 'Apple iPhone 15 Pro',
      subjectDistanceRange: 'Close view',
      subjectDistance: 2.5,
      imgDirection: 245,
      destBearing: 250,
      gpsSpeed: 5,
      keywords: 'street, mural',
      imageUniqueId: 'abc123unique',
      latitude: 37.7749,
      longitude: -122.4194
    }

    const poster = make_poster()
    write_poster_exif(poster, sample)

    const parsed = read_poster_exif(poster.outerHTML, itemid)
    for (const key of POSTER_EXIF_FIELDS)
      if (sample[key] != null) expect(parsed?.[key]).toEqual(sample[key])
  })

  it('writes SVG-native metadata microdata', () => {
    const poster = make_poster()
    write_poster_exif(poster, {
      camera: 'Leica M11',
      subjectDistanceRange: 'Macro',
      destBearing: 180,
      imageUniqueId: 'id-1'
    })
    const html = poster.outerHTML
    expect(html).toContain('<metadata>')
    expect(html).toContain('itemprop="exif"')
    expect(html).toContain('itemprop="destBearing"')
    expect(html).not.toMatch(/<span|<data|<ol|<li/)
  })

  it('replaces previously written EXIF instead of duplicating', () => {
    const poster = make_poster()
    write_poster_exif(poster, { camera: 'Old camera' })
    write_poster_exif(poster, { camera: 'New camera', iso: '200' })
    const parsed = read_poster_exif(poster.outerHTML, itemid)
    expect(parsed?.camera).toBe('New camera')
    expect(parsed?.iso).toBe('200')
    expect(poster.querySelectorAll('[itemprop="exif"]').length).toBe(1)
  })

  it('clears EXIF when given null', () => {
    const poster = make_poster()
    write_poster_exif(poster, { camera: 'Canon R5' })
    write_poster_exif(poster, null)
    expect(read_poster_exif(poster.outerHTML, itemid)).toBeNull()
  })
})
