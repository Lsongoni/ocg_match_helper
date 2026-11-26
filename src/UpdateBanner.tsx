import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { activateUpdate, getUpdateSnapshot, subscribeUpdates, type UpdateSnapshot } from './updates'

/**
 * 新版本就绪时在底部导航上方出现一条提示，不打断当前操作。
 * 比赛途中不会弹窗抢焦点，用户可以录完这一场再点更新。
 */
export function UpdateBanner() {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot>(getUpdateSnapshot)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => subscribeUpdates(() => setSnapshot(getUpdateSnapshot())), [])

  if (snapshot.status !== 'ready' || dismissed) return null

  return <div className="update-banner" role="status">
    <span className="update-banner-text">新版本已准备好</span>
    <button className="update-banner-action" onClick={() => void activateUpdate()}><RefreshCw size={15} />立即更新</button>
    <button className="update-banner-close" onClick={() => setDismissed(true)} aria-label="稍后更新"><X size={16} /></button>
  </div>
}
