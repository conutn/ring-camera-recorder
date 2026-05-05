import 'dotenv/config'
import { PushNotificationAction, RingApi } from 'ring-client-api'
import { skip } from 'rxjs/operators'
import { readFile, writeFile } from 'fs'
import { promisify } from 'util'

async function main() {
  const { env } = process,
    ringApi = new RingApi({
      refreshToken: env.RING_REFRESH_TOKEN!,
      debug: false,
    }),
    locations = await ringApi.getLocations(),
    allCameras = await ringApi.getCameras()

  console.log(
    `Found ${locations.length} location(s) with ${allCameras.length} camera(s).`,
  )

  /*ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
      if (!oldRefreshToken) {
        return
      }

      const currentConfig = await promisify(readFile)('.env'),
        updatedConfig = currentConfig
          .toString()
          .replace(oldRefreshToken, newRefreshToken)

      console.log('Updated refresh token')

      await promisify(writeFile)('.env', updatedConfig)
    },
  )*/

  for (const location of locations) {
    location.onConnected.pipe(skip(1)).subscribe((connected) => {
      const status = connected ? 'Connected to' : 'Disconnected from'
      console.log(`**** ${status} location ${location.name} - ${location.id}`)
    })
  }

  for (const location of locations) {
    const cameras = location.cameras,
      devices = await location.getDevices()

    console.log(
      `\nLocation ${location.name} (${location.id}) has the following ${cameras.length} camera(s):`,
    )

    for (const camera of cameras) {
      console.log(`- ${camera.id}: ${camera.name} (${camera.deviceType})`)
    }

    console.log(
      `\nLocation ${location.name} (${location.id}) has the following ${devices.length} device(s):`,
    )

    for (const device of devices) {
      console.log(`- ${device.zid}: ${device.name} (${device.deviceType})`)
    }
  }

  if (allCameras.length) {
    allCameras.forEach(async (camera) => {
      camera.onNewNotification.subscribe(async (notification) => {
        const action = notification.android_config.category,
          event =
            action === PushNotificationAction.Motion
              ? 'Motion detected'
              : action === PushNotificationAction.Ding
              ? 'Doorbell pressed'
              : `Video started (${action})`

        const date = new Date()
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        const seconds = date.getSeconds().toString().padStart(2, '0')
        const t = `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`

        console.log(`Starting video from ${camera.name} ...`)
        console.log('Saving to C:/Users/justi/Documents/output/' + t + '.mp4')

        await camera.recordToFile('C:/Users/justi/Documents/output/' + t + '.mp4', 10)

        console.log('Done recording video')
      })
      console.log(`Listening to camera ${camera.name}`)
    })

    console.log('Listening for motion and doorbell presses on your cameras.')
  }
}

main().catch((e: any) => {
  console.error('Main threw an error:', e)
})
