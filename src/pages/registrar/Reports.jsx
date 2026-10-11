import ReportViewer from '../../components/ReportViewer.jsx'

export default function Reports() {
  return (
    <ReportViewer
      endpoint="/registrar/reports"
      title="Reports"
      subtitle="Generate, print or export registrar activity."
      types={[
        ['documents', 'Document Request Report'],
        ['enrollment', 'Enrollment Report', false],
        ['clearance', 'Clearance Report', false],
        ['queue', 'Queue Report'],
      ]}
    />
  )
}
