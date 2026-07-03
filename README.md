# Instagram Video / Image downloader
Your best mobile web Instagram downloader!

Paste your instagram share link and enjoy.
This project has been deployed on vercel.
Demo link: [instagram-downloader](https://instagram-downloader-ten.vercel.app/)

![img.png](https://hv.z.wiki/autoupload/20241203/aFDp/696X1382/Pasted_Graphic.png)

## How to use
```shell
npm install && npm run dev
```

## Redis cache
Configure Upstash Redis to keep `/api/media` download URLs short without
re-parsing Instagram for every media item:

```shell
UPSTASH_REDIS_REST_URL=your-upstash-rest-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
MEDIA_CACHE_TTL_SECONDS=1800
```

`MEDIA_CACHE_TTL_SECONDS` is optional and defaults to 30 minutes. If Redis is
not configured or a cache entry expires, download URLs fall back to resolving by
`postUrl` and `index`.

## Features
- Various types of instagram share link: post, reel, igtv...
- Video preview
- Image preview
- Share your download link
- Error message

## Next Steps
- Support PWA ✅
- More compatible
- Add image preview ✅
- Add video download button ✅
- Adapt to desktop screen size
- Instagram story
- Private post

## Acknowledgements
[Instagram Video Downloader](https://github.com/riad-azz/instagram-video-downloader)

[corsDown](https://github.com/crypto-su/corsDown)
