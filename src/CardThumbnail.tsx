import { useState } from 'react'

export function CardThumbnail({ id }: { id: number }) {
  const [failed, setFailed] = useState(false)
  return <span className="card-thumbnail" aria-hidden="true">
    {failed ? <span>暂无卡图</span> : <img src={`https://cdn.233.momobako.com/ygopro/pics/${id}.jpg!thumb`} alt="" width={44} height={64} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
  </span>
}
