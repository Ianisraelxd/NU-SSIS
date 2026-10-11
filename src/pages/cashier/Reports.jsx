import ReportViewer from '../../components/ReportViewer.jsx'

export default function CashierReports() {
  return <ReportViewer endpoint="/cashier/reports" title="Collection Reports" subtitle="Money collected for tuition and document fees." types={[['collections', 'Collection Report']]} />
}
