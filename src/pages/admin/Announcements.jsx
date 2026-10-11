import AnnouncementsManager from '../../components/AnnouncementsManager.jsx'
import { PageHead } from '../../components/ui.jsx'

export default function Announcements() {
  return (
    <div className="stack">
      <PageHead title="Announcements" subtitle="School-wide news shown on every student’s home page." />
      <AnnouncementsManager base="/admin" />
    </div>
  )
}
