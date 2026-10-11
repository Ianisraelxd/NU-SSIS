import ReportViewer from '../../components/ReportViewer.jsx'

export default function AdminReports() {
  return (
    <ReportViewer
      endpoint="/admin/reports"
      title="System Reports"
      subtitle="System-wide reports across every module."
      types={[
        ['system', 'System Summary', false],
        ['documents', 'Document Request Report'],
        ['enrollment', 'Enrollment Report', false],
        ['clearance', 'Clearance Report', false],
        ['queue', 'Queue Report'],
        ['collections', 'Collection Report'],
      ]}
    />
  )
}
