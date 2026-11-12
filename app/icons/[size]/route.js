import { ImageResponse } from 'next/og';

// App icons generated on the fly (/icons/180, /icons/192, /icons/512).
export async function GET(_req, { params }) {
  const { size: raw } = await params;
  const size = [180, 192, 512].includes(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #5b8cff, #3ecf8e)',
          color: 'white',
          fontSize: size * 0.58,
          fontWeight: 800,
        }}
      >
        £
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=604800, immutable' } }
  );
}
