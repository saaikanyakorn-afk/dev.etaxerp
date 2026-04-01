import { Component, type ErrorInfo, type ReactNode, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, setUpgradeCallback } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CompanyProvider, useCompany } from "@/lib/company-context";
import { DateSettingsProvider } from "@/hooks/use-date-settings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PageLoader from "@/components/page-loader";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    const msg = error?.message || "";
    if (msg.includes("dynamically imported module") || msg.includes("Failed to fetch") || msg.includes("ChunkLoadError")) {
      const reloadKey = "chunk-reload-" + window.location.pathname;
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "Sarabun, sans-serif" }}>
          <h2 style={{ color: "#f94d4d", marginBottom: 16 }}>เกิดข้อผิดพลาด</h2>
          <p style={{ color: "#666", marginBottom: 16 }}>{this.state.error?.message}</p>
          <button
            onClick={() => { sessionStorage.clear(); this.setState({ hasError: false }); window.location.reload(); }}
            style={{ padding: "8px 24px", background: "#fb9678", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
          >
            โหลดใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import EcommercePricing from "@/pages/ecommerce-pricing";
import AccountingPricing from "@/pages/accounting-pricing";
import DeliveryPricing from "@/pages/delivery-pricing";
import FoodDeliveryPricing from "@/pages/food-delivery-pricing";
import RegisterPage from "@/pages/register";
const ChoosePlanPage = lazy(() => import("@/pages/choose-plan"));
import PlatformDashboard from "@/pages/platform/dashboard";
import PlatformTenants from "@/pages/platform/tenants";
import ChatManagement from "@/pages/platform/chat-management";
import PlatformSubscriptions from "@/pages/platform/subscriptions";
import PlatformPaymentSettings from "@/pages/platform/payment-settings";
import DatabaseBackup from "@/pages/platform/database-backup";
import DatabaseServers from "@/pages/platform/database-servers";
import DatabaseSwitch from "@/pages/platform/database-switch";
import DownloadSource from "@/pages/platform/download-source";
import PlatformMaintenance from "@/pages/platform/maintenance";
import PasswordManagement from "@/pages/platform/password-management";
import Dashboard from "@/pages/dashboard";
import Journal from "@/pages/journal";
import JournalForm from "@/pages/journal-form";
import JournalPrint from "@/pages/journal-print";
import Coa from "@/pages/coa";
import AccountingMgmt from "@/pages/accounting-mgmt";
import VatClosing from "@/pages/vat-closing";
import BalanceCarryForward from "@/pages/accounting-mgmt/balance-carry-forward";
import TrialBalanceCompare from "@/pages/accounting-mgmt/trial-balance-compare";
import TrimData from "@/pages/accounting-mgmt/trim-data";
import JournalValidation from "@/pages/accounting-mgmt/journal-validation";
import DuplicateDetection from "@/pages/accounting-mgmt/duplicate-detection";
import PeriodClosing from "@/pages/accounting-mgmt/period-closing";
import CleanZero from "@/pages/accounting-mgmt/clean-zero";
import FixDiff from "@/pages/accounting-mgmt/fix-diff";
import ChangeAnchor from "@/pages/accounting-mgmt/change-anchor";
import GlNoDoc from "@/pages/accounting-mgmt/gl-no-doc";
import OrphanJournal from "@/pages/accounting-mgmt/orphan-journal";
import RestaurantPosIndex from "@/pages/restaurant-pos/index";
import RestaurantOrder from "@/pages/restaurant-pos/order";
import KitchenDisplay from "@/pages/restaurant-pos/kitchen";
import TableSettings from "@/pages/restaurant-pos/table-settings";
import MenuSettingsPage from "@/pages/restaurant-pos/menu-settings";
import AccountingConfig from "@/pages/accounting-config";
import PettyCash from "@/pages/petty-cash";
import DueCalendar from "@/pages/finance/due-calendar";
import CashFlowForecast from "@/pages/finance/cash-flow-forecast";
import ReceiptBilling from "@/pages/finance/receipt-billing";
import BillingNotes from "@/pages/finance/billing-notes";
import BillingNotePdf from "@/pages/finance/billing-note-pdf";
import APBilling from "@/pages/finance/ap-billing";
import FinancePayments from "@/pages/finance/payments";
import QuotationList from "@/pages/sales/quotation-list";
import SalesPipeline from "@/pages/sales/pipeline";
import SalesTaxReport from "@/pages/sales/tax-report";
import PurchaseRequest from "@/pages/purchases/purchase-request";
import PurchaseRequestList from "@/pages/purchases/purchase-request-list";
import BidComparisonList from "@/pages/purchases/bid-comparison-list";
import BidComparison from "@/pages/purchases/bid-comparison";
import PurchaseOrderList from "@/pages/purchases/purchase-order-list";
import PurchaseOrder from "@/pages/purchases/purchase-order";
import ExpenseList from "@/pages/purchases/expense-list";
import ExpenseEntry from "@/pages/purchases/expense";
import ExpenseImport from "@/pages/purchases/expense-import";
import PurchaseInvoiceList from "@/pages/purchases/purchase-invoice-list";
import PurchaseInvoice from "@/pages/purchases/purchase-invoice";
import PurchaseImport from "@/pages/purchases/purchase-import";
import PurchasePdfImport from "@/pages/purchases/purchase-pdf-import";
import ExpensePdfImport from "@/pages/purchases/expense-pdf-import";
import PdfBulkImport from "@/pages/purchases/pdf-bulk-import";
import PurchaseTaxReport from "@/pages/purchases/tax-report";
import WhtCertList from "@/pages/purchases/wht-cert-list";
import WhtCertForm from "@/pages/purchases/wht-cert-form";
import WhtCertPrint from "@/pages/purchases/wht-cert-print";
import WhtCertShare from "@/pages/purchases/wht-cert-share";
import WhtAttachmentPrint from "@/pages/purchases/wht-attachment-print";
import DebitNoteList from "@/pages/purchases/debit-note-list";
import DebitNoteForm from "@/pages/purchases/debit-note-form";
import DepositList from "@/pages/sales/deposit-list";
import DepositForm from "@/pages/sales/deposit-form";
import PurchaseDepositList from "@/pages/purchases/purchase-deposit-list";
import PurchaseDepositForm from "@/pages/purchases/purchase-deposit-form";
import InventoryList from "@/pages/inventory/inventory-list";
import BomManagement from "@/pages/inventory/bom-management";
import BundleManagement from "@/pages/inventory/bundle-management";
import PromotionManagement from "@/pages/inventory/promotion-management";
import ProductMapping from "@/pages/inventory/product-mapping";
import ProductForm from "@/pages/inventory/product-form";
import BomFormPage from "@/pages/inventory/bom-form";
import BundleFormPage from "@/pages/inventory/bundle-form";
import PromotionFormPage from "@/pages/inventory/promotion-form";
import MappingFormPage from "@/pages/inventory/mapping-form";
import ContactList from "@/pages/contacts/contact-list";
import ContactForm from "@/pages/contacts/contact-form";
import ContactHistory from "@/pages/contacts/contact-history";
import ContactSettings from "@/pages/contacts/contact-settings";
import AssetRegistry from "@/pages/assets/asset-registry";
import AssetForm from "@/pages/assets/asset-form";
import DepreciationPage from "@/pages/assets/depreciation";
import AssetSalesReport from "@/pages/assets/asset-sales-report";
import AssetExpiredReport from "@/pages/assets/asset-expired-report";
import AssetSummary from "@/pages/assets/asset-summary";
import AssetAccountingHistory from "@/pages/assets/asset-accounting-history";
import InstallmentContracts from "@/pages/assets/installment-contracts";
import AssetCategories from "@/pages/assets/asset-categories";
import GeneralReports from "@/pages/reports/general-reports";
import GeneralLedger from "@/pages/reports/general-ledger";
import TrialBalance from "@/pages/reports/trial-balance";
import IncomeStatement from "@/pages/reports/income-statement";
import BalanceSheet from "@/pages/reports/balance-sheet";
import CashFlowStatement from "@/pages/reports/cash-flow";
import AccountStatementPage from "@/pages/reports/account-statement";
import AccountStatementContactPage from "@/pages/reports/account-statement-contact";
import ReconcileAccountTypePage from "@/pages/reports/reconcile-account-type";
import WorksheetPage from "@/pages/reports/worksheet";
import AccountingLogPage from "@/pages/reports/accounting-log";
import PurchaseTaxPendingPage from "@/pages/reports/purchase-tax-pending";
import Pnd3Page from "@/pages/reports/pnd3";
import Pnd53Page from "@/pages/reports/pnd53";
import TaxReconcilePage from "@/pages/reports/tax-reconcile";
import VatPp30FromTbPage from "@/pages/reports/vat-pp30-from-tb";
import IncomeStatementCompare from "@/pages/reports/income-statement-compare";
import BalanceSheetCompare from "@/pages/reports/balance-sheet-compare";
import BalanceSheetCompareAmount from "@/pages/reports/balance-sheet-compare-amount";
import BalanceSheet12MonthChart from "@/pages/reports/balance-sheet-12month-chart";
import IncomeStatementCompareAmount from "@/pages/reports/income-statement-compare-amount";
import IncomeStatement12Month from "@/pages/reports/income-statement-12month";
import IncomeStatement12MonthChart from "@/pages/reports/income-statement-12month-chart";
import IncomeStatementCumulative from "@/pages/reports/income-statement-cumulative";
import IncomeStatementMonthYear from "@/pages/reports/income-statement-month-year";
import IncomeStatementPct from "@/pages/reports/income-statement-pct";
import IncomeStatementQuarterly from "@/pages/reports/income-statement-quarterly";
import JournalBookReport from "@/pages/reports/journal-book-report";
import FinancialNotes from "@/pages/reports/financial-notes";
import FinancialStatementsPackage from "@/pages/reports/financial-statements-package";
import SalesReport from "@/pages/reports/sales-report";
import BudgetEntry from "@/pages/reports/budget-entry";
import BudgetVsActual from "@/pages/reports/budget-vs-actual";
import GrossProfitReport from "@/pages/reports/gross-profit-report";
import SalesByDocument from "@/pages/reports/sales-by-document";
import SalesByDepartment from "@/pages/reports/sales-by-department";
import SalesByProject from "@/pages/reports/sales-by-project";
import SalesByAccount from "@/pages/reports/sales-by-account";
import SalesItemDetails from "@/pages/reports/sales-item-details";
import DailySalesSummary from "@/pages/reports/daily-sales-summary";
import TopProducts from "@/pages/reports/top-products";
import SalesMonthlyComparison from "@/pages/reports/sales-monthly-comparison";
import GrossProfitByProduct from "@/pages/reports/gross-profit-by-product";
import OpexCapexReport from "@/pages/reports/opex-capex";
import GrowthTrendReport from "@/pages/reports/growth-trend";
import DepartmentPLReport from "@/pages/reports/department-pl";
import BreakEvenReport from "@/pages/reports/break-even";
import FinancialManagement from "@/pages/reports/financial-management";
import ARAgingReport from "@/pages/reports/ar-aging";
import ARAgingInvoicesReport from "@/pages/reports/ar-aging-invoices";
import APAgingReport from "@/pages/reports/ap-aging";
import FinancialRatiosDashboard from "@/pages/reports/financial-ratios";
import VatPP30Report from "@/pages/reports/vat-pp30";
import FirmManagement from "@/pages/firm-mgmt/dashboard";
import HRMDashboard from "@/pages/hr/hrm-dashboard";
import HRAttendance from "@/pages/hr/attendance";
import AttendanceReport from "@/pages/hr/attendance-report";
import EmployeeList from "@/pages/hr/employee-list";
import LeaveManagement from "@/pages/hr/leave-management";
import LeavePolicySettings from "@/pages/hr/leave-policy-settings";
import PayslipPage from "@/pages/hr/payslip";
import Certificates from "@/pages/hr/certificates";
import HolidaysPage from "@/pages/hr/holidays";
import WorkSchedulePage from "@/pages/hr/work-schedule";
import ShiftSettingsPage from "@/pages/hr/shift-settings";
import ShiftSchedulePage from "@/pages/hr/shift-schedule";
const OTManagement = lazy(() => import("@/pages/hr/ot-management"));
import ScannerMapping from "@/pages/hr/scanner-mapping";
import ScannerImport from "@/pages/hr/scanner-import";
import PayrollTax from "@/pages/hr/payroll-tax";
import WhtImport from "@/pages/hr/wht-import";
import FinancialStatementsGenerator from "@/pages/tax-tools/financial-statements-generator";
import GovReceiptDownloader from "@/pages/tools/gov-receipt-downloader";
import Performance from "@/pages/hr/performance";
const CommissionRules = lazy(() => import("@/pages/hr/commission-rules"));
const CommissionRecords = lazy(() => import("@/pages/hr/commission"));
import EssDashboard from "@/pages/ess/ess-dashboard";
import TaskBoardPage from "@/pages/office/task-board";
import WorkBoardPage from "@/pages/office/work-board";
import ContractsPage from "@/pages/firm-mgmt/contracts";
import FirmBilling from "@/pages/firm-mgmt/billing";
import FirmDocuments from "@/pages/firm-mgmt/documents";
import FirmAssignments from "@/pages/firm-mgmt/assignments";
import LineDocumentArchive from "@/pages/line-document-archive";
const EtaxHubDashboard = lazy(() => import("@/pages/etax-hub/dashboard"));
const EtaxHubClientBoard = lazy(() => import("@/pages/etax-hub/client-board"));
const EtaxHubMyCalendar = lazy(() => import("@/pages/etax-hub/my-calendar"));
const TaxReminderSettings = lazy(() => import("@/pages/tax-reminder-settings"));
const SharedBoardPage = lazy(() => import("@/pages/etax-hub/shared-board"));
const ExternalRegisterPage = lazy(() => import("@/pages/etax-hub/external-register"));
const ExternalBoardPage = lazy(() => import("@/pages/etax-hub/external-board"));
import ContractSignPage from "@/pages/contract-sign";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import FeaturesPage from "@/pages/features";
import PricingPage from "@/pages/pricing";
import UserGuide from "@/pages/user-guide";
import Login from "@/pages/login";
import UserManagement from "@/pages/settings/user-management";
import AccountingFormulas from "@/pages/accounting-formulas";
import DocumentTemplates from "@/pages/settings/document-templates";
import UserProfile from "@/pages/settings/user-profile";
import FirmLinkPage from "@/pages/settings/firm-link";
import ModuleSelectPage from "@/pages/module-select";
import CompanyInfo from "@/pages/settings/company-info";
import PaymentMethodSettings from "@/pages/settings/payment-methods";
import MySubscription from "@/pages/settings/my-subscription";
import UpgradePlan from "@/pages/settings/upgrade";
import WhiteLabelSettings from "@/pages/settings/white-label";
import LandingCmsPage from "@/pages/settings/landing-cms";
import FtpArchiveSettings from "@/pages/settings/ftp-archive";
import EtaxSettings from "@/pages/settings/etax-settings";
import LineSettings from "@/pages/settings/line-settings";
import GeneralSettings from "@/pages/settings/general-settings";
import DeptBranchSettings from "@/pages/settings/dept-branch";
import DashboardAnalytical from "@/pages/dashboard-analytical";
import SalesOrderList from "@/pages/sales/sales-order-list";
import SalesOrderForm from "@/pages/sales/sales-order-form";
import QuotationForm from "@/pages/sales/quotation-form";
import QuotationPdf from "@/pages/sales/quotation-pdf";
import QuotationShare from "@/pages/sales/quotation-share";
import SalesOrderPdf from "@/pages/sales/sales-order-pdf";
import SalesOrderShare from "@/pages/sales/sales-order-share";
import InvoicePdf from "@/pages/sales/invoice-pdf";
import InvoiceShare from "@/pages/sales/invoice-share";
import TaxInvoicePdf from "@/pages/sales/tax-invoice-pdf";
import TaxInvoiceBatchPrint from "@/pages/sales/tax-invoice-batch-print";
import TaxInvoiceShare from "@/pages/sales/tax-invoice-share";
import ReceiptPdf from "@/pages/sales/receipt-pdf";
import ReceiptShare from "@/pages/sales/receipt-share";
import InvoiceList from "@/pages/sales/invoice-list";
import InvoiceForm from "@/pages/sales/invoice-form";
import InvoiceImport from "@/pages/sales/invoice-import";
import TaxInvoiceList from "@/pages/sales/tax-invoice-list";
import TaxInvoiceForm from "@/pages/sales/tax-invoice-form";
import EtaxSentList from "@/pages/sales/etax-sent-list";
import ReceiptList from "@/pages/sales/receipt-list";
import ReceiptForm from "@/pages/sales/receipt-form";
import CreditNoteList from "@/pages/sales/credit-note-list";
import CreditNoteForm from "@/pages/sales/credit-note-form";
import WarehousePage from "@/pages/inventory/warehouse";
import StockCardPage from "@/pages/inventory/stock-card";
import StockTransferPage from "@/pages/inventory/stock-transfer";
import GoodsReceivingList from "@/pages/inventory/goods-receiving-list";
import GoodsReceivingForm from "@/pages/inventory/goods-receiving-form";
import ProductLotsPage from "@/pages/inventory/product-lots";
import ManufacturingList from "@/pages/inventory/manufacturing-list";
import ManufacturingForm from "@/pages/inventory/manufacturing-form";
import GoodsRequisitionList from "@/pages/inventory/goods-requisition-list";
import GoodsRequisitionForm from "@/pages/inventory/goods-requisition-form";
import InventoryValuation from "@/pages/inventory/inventory-valuation";
import MovementSummary from "@/pages/inventory/movement-summary";
import SlowMoving from "@/pages/inventory/slow-moving";
import BarcodeLabels from "@/pages/inventory/barcode-labels";
import ProductImportExport from "@/pages/inventory/product-import-export";
import EcommerceHub from "@/pages/ecommerce/ecommerce-hub";
import EcommerceDashboard from "@/pages/ecommerce/ecommerce-dashboard";
import EcommerceConnections from "@/pages/ecommerce/ecommerce-connections";
import OrderImport from "@/pages/ecommerce/order-import";
import GrabFoodConnect from "@/pages/ecommerce/grab-food-connect";
import EcommerceDocuments from "@/pages/ecommerce/ecommerce-documents";
import EcommerceQuickInvoice from "@/pages/ecommerce/ecommerce-quick-invoice";
import EcommerceOrders from "@/pages/ecommerce/ecommerce-orders";
import EcommerceInventory from "@/pages/ecommerce/ecommerce-inventory";
import EcommerceInventoryBom from "@/pages/ecommerce/ecommerce-inventory-bom";
import EcommerceInventoryManufacturing from "@/pages/ecommerce/ecommerce-inventory-manufacturing";
import EcommerceInventoryBundles from "@/pages/ecommerce/ecommerce-inventory-bundles";
import EcommerceInventoryPromotions from "@/pages/ecommerce/ecommerce-inventory-promotions";
import EcommerceInventoryWarehouse from "@/pages/ecommerce/ecommerce-inventory-warehouse";
import EcommerceInventoryStockCard from "@/pages/ecommerce/ecommerce-inventory-stock-card";
import EcommerceInventoryValuation from "@/pages/ecommerce/ecommerce-inventory-valuation";
import EcommerceInventoryMovement from "@/pages/ecommerce/ecommerce-inventory-movement";
import EcommerceInventorySlowMoving from "@/pages/ecommerce/ecommerce-inventory-slow-moving";
import EcommerceStockSync from "@/pages/ecommerce/ecommerce-stock-sync";
import SkuSmartMapping from "@/pages/ecommerce/sku-smart-mapping";
import EcommerceSettings from "@/pages/ecommerce/ecommerce-settings";
import PriceCalculator from "@/pages/ecommerce/price-calculator";
import BusinessInsights from "@/pages/ecommerce/business-insights";
import EcommerceSettlements from "@/pages/ecommerce/ecommerce-settlements";
import SettlementImport from "@/pages/ecommerce/settlement-import";
import WithdrawalImport from "@/pages/ecommerce/withdrawal-import";
import EcommerceReturns from "@/pages/ecommerce/ecommerce-returns";
import EcommerceReturnsReport from "@/pages/ecommerce/ecommerce-returns-report";
import EcommerceReturnsScan from "@/pages/ecommerce/ecommerce-returns-scan";
import EcommerceReturnsQC from "@/pages/ecommerce/ecommerce-returns-qc";
import EcommerceAnalytics from "@/pages/ecommerce/ecommerce-analytics";
import EcommerceWarehouses from "@/pages/ecommerce/ecommerce-warehouses";
import EcommerceFulfillment from "@/pages/ecommerce/ecommerce-fulfillment";
import EcommerceShippingLabels from "@/pages/ecommerce/ecommerce-shipping-labels";
import EcommercePackingCameras from "@/pages/ecommerce/ecommerce-packing-cameras";
import EcommerceAiAnalytics from "@/pages/ecommerce/ecommerce-ai-analytics";
import EcommerceSupplierPortal from "@/pages/ecommerce/ecommerce-supplier-portal";
import ClientUploadPage from "@/pages/client-upload";
import EcommercePdaMobile from "@/pages/ecommerce/ecommerce-pda-mobile";
import EcommerceBinLocations from "@/pages/ecommerce/ecommerce-bin-locations";
import EcommercePackingStation from "@/pages/ecommerce/ecommerce-packing-station";
import EcommercePackingRecordings from "@/pages/ecommerce/ecommerce-packing-recordings";
import EcommerceWavePicking from "@/pages/ecommerce/ecommerce-wave-picking";
import DeliveryDashboard from "@/pages/delivery/delivery-dashboard";
import DeliveryFulfillment from "@/pages/delivery/delivery-fulfillment";
import DeliveryShippingLabels from "@/pages/delivery/delivery-shipping-labels";
import DeliveryTracking from "@/pages/delivery/delivery-tracking";
import DeliveryLineNotify from "@/pages/delivery/delivery-line-notify";
import DeliveryNotesPage from "@/pages/delivery/delivery-notes";
import DeliveryNoteFormPage from "@/pages/delivery/delivery-note-form";
import DeliverySignPublicPage from "@/pages/delivery/delivery-sign-public";
import DeliveryShipments from "@/pages/delivery/delivery-shipments";
import DeliveryScan from "@/pages/delivery/delivery-scan";
import DeliverySettings from "@/pages/delivery/delivery-settings";
import FoodDashboard from "@/pages/food-delivery/food-dashboard";
import FoodOrders from "@/pages/food-delivery/food-orders";
import FoodMenu from "@/pages/food-delivery/food-menu";
import FoodConnections from "@/pages/food-delivery/food-connections";
import FoodStores from "@/pages/food-delivery/food-stores";
import FoodAnalytics from "@/pages/food-delivery/food-analytics";
import FoodHistory from "@/pages/food-delivery/food-history";
import FoodSettings from "@/pages/food-delivery/food-settings";
import FoodImport from "@/pages/food-delivery/food-import";
import FoodAccounting from "@/pages/food-delivery/food-accounting";
import EcommerceAutoSync from "@/pages/ecommerce/ecommerce-auto-sync";
import PlatformCredentials from "@/pages/ecommerce/platform-credentials";
import EcommerceChatInbox from "@/pages/ecommerce/ecommerce-chat-inbox";
import EcommerceChatAutoReply from "@/pages/ecommerce/ecommerce-chat-auto-reply";
import EcommerceChatKeywords from "@/pages/ecommerce/ecommerce-chat-keywords";
import EcommerceApiConnect from "@/pages/ecommerce/ecommerce-api-connect";
import EcommerceFacebookOrders from "@/pages/ecommerce/ecommerce-facebook-orders";
import EcommerceStockAlerts from "@/pages/ecommerce/ecommerce-stock-alerts";
import EcommerceReconciliation from "@/pages/ecommerce/ecommerce-reconciliation";
import EcommerceStoreClone from "@/pages/ecommerce/ecommerce-store-clone";
import LiveSellingHub from "@/pages/live-selling/live-selling-hub";
import LiveSellingDashboard from "@/pages/live-selling/live-selling-dashboard";
import LiveSellingLuckyDraw from "@/pages/live-selling/live-selling-lucky-draw";
import AgencyDashboard from "@/pages/live-agency/agency-dashboard";
import LiveMonitor from "@/pages/live-agency/live-monitor";
import PostLiveReport from "@/pages/live-agency/post-live-report";
import LivePlanning from "@/pages/live-agency/live-planning";
import PosTerminal from "@/pages/pos/pos-terminal";
import PosSessions from "@/pages/pos/pos-sessions";
import PosBranches from "@/pages/pos/pos-branches";
import PosDashboard from "@/pages/pos/pos-dashboard";
import PosReceipt from "@/pages/pos/pos-receipt";
import PosSalesList from "@/pages/pos/pos-sales-list";
import PosInvoice from "@/pages/pos/pos-invoice";
import LoyaltyManagement from "@/pages/pos/loyalty-management";
const LoyaltySignup = lazy(() => import("@/pages/pos/loyalty-signup"));
import PosHubDashboard from "@/pages/pos/pos-hub-dashboard";
import PosHubSalesByBranch from "@/pages/pos/pos-hub-sales-by-branch";
import PosHubSalesByProduct from "@/pages/pos/pos-hub-sales-by-product";
import PosHubSalesByCategory from "@/pages/pos/pos-hub-sales-by-category";
import PosHubBestSellers from "@/pages/pos/pos-hub-best-sellers";
import PosHubPaymentAnalysis from "@/pages/pos/pos-hub-payment-analysis";
import PosHubCashierPerformance from "@/pages/pos/pos-hub-cashier-performance";
import PosHubHourlyTrends from "@/pages/pos/pos-hub-hourly-trends";
import PosHubDailySummary from "@/pages/pos/pos-hub-daily-summary";
import PosProducts from "@/pages/pos/pos-products";
import PosProductForm from "@/pages/pos/pos-product-form";
import PosBundles from "@/pages/pos/pos-bundles";
import PosBundleForm from "@/pages/pos/pos-bundle-form";
import PosStock from "@/pages/pos/pos-stock";
import PosStockCard from "@/pages/pos/pos-stock-card";
import PosTaxInvoices from "@/pages/pos/pos-tax-invoices";
import PosSettings from "@/pages/pos/pos-settings";
import JobCostingProjectList from "@/pages/job-costing/project-list";
import JobCostingProjectDetail from "@/pages/job-costing/project-detail";
import GasFuelSetup from "@/pages/gas-station/fuel-setup";
import GasStationDashboard from "@/pages/gas-station/dashboard";
import GasStationIntegration from "@/pages/gas-station/integration";
import GasDailySales from "@/pages/gas-station/daily-sales";
import GasFuelStock from "@/pages/gas-station/fuel-stock";
import GasOilLossGain from "@/pages/gas-station/oil-loss-gain";
import GasLocalTax from "@/pages/gas-station/local-tax";
import GasReports from "@/pages/gas-station/reports";
const PdfStressTest = lazy(() => import("./pages/dev/pdf-stress-test"));
const ActivityLog = lazy(() => import("./pages/activity-log"));
const SystemInfo = lazy(() => import("./pages/system-info"));
const ApprovalCenter = lazy(() => import("./pages/approval-center"));
const ApprovalSettingsPage = lazy(() => import("./pages/settings/approval-settings"));
const ApproveByTokenPage = lazy(() => import("./pages/approve-by-token"));
const BankReconciliation = lazy(() => import("./pages/reports/bank-reconciliation"));
const CustomerList = lazy(() => import("./pages/crm/customer-list"));
const CustomerDetail = lazy(() => import("./pages/crm/customer-detail"));
const AdTracking = lazy(() => import("./pages/ads/ad-tracking"));
const CIExecutive = lazy(() => import("./pages/commerce-intelligence/ci-executive"));
const CIChannel = lazy(() => import("./pages/commerce-intelligence/ci-channel"));
const CIProduct = lazy(() => import("./pages/commerce-intelligence/ci-product"));
const CICampaign = lazy(() => import("./pages/commerce-intelligence/ci-campaign"));
const CILive = lazy(() => import("./pages/commerce-intelligence/ci-live"));
const CIAlerts = lazy(() => import("./pages/commerce-intelligence/ci-alerts"));
const InternalChat = lazy(() => import("./pages/office/internal-chat"));
const MeetingsPage = lazy(() => import("./pages/office/meetings"));
const FullCalendar = lazy(() => import("./pages/office/full-calendar"));
const MobileExecutiveDashboard = lazy(() => import("./pages/mobile/executive-dashboard"));
const MobileExpenseSnap = lazy(() => import("./pages/mobile/expense-snap"));
const LegacyLoginPage = lazy(() => import("./pages/legacy-import/login"));
const LegacyImportPage = lazy(() => import("./pages/legacy-import/index"));
const LegacyImportDbPage = lazy(() => import("./pages/legacy-import/import-db"));
const LegacyViewerPage = lazy(() => import("./pages/legacy-import/viewer"));
const LegacyCompanyManagerPage = lazy(() => import("./pages/legacy-import/company-manager"));
const LegacyChartOfAccountsPage = lazy(() => import("./pages/legacy-import/chart-of-accounts"));
const LegacyContactsPage = lazy(() => import("./pages/legacy-import/contacts"));
const LegacyDocumentsPage = lazy(() => import("./pages/legacy-import/documents"));
const LegacyGlJournalPage = lazy(() => import("./pages/legacy-import/gl-journal"));
const LegacyReportsPage = lazy(() => import("./pages/legacy-import/reports"));
import ChatWidget from "@/components/chat-widget";
import InternalChatWidget from "@/components/internal-chat-widget";
function DashboardRedirect() {
  const { isAccountingFirm } = useCompany();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (user && (user as any).role === "super_admin") {
      navigate("/platform", { replace: true });
    } else {
      navigate(isAccountingFirm ? "/dashboard/analytical" : "/dashboard/ecommerce", { replace: true });
    }
  }, [isAccountingFirm, user, navigate]);
  return null;
}

function ModuleSelectRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/module-select", { replace: true }); }, [navigate]);
  return null;
}

function ExternalUserGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if ((user as any)?.role === "client_external") return null;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!loading) {
      if (user && (user as any).role === "client_external") {
        navigate("/etax-hub/board", { replace: true });
      } else if (user && (user as any).role === "super_admin") {
        navigate("/platform", { replace: true });
      } else if (user && (user as any).role === "employee") {
        navigate("/ess", { replace: true });
      } else {
        navigate(user ? "/module-select" : "/landing", { replace: true });
      }
    }
  }, [user, loading, navigate]);
  if (loading) return <PageLoader />;
  return null;
}

function TrialGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const publicPaths = ["/landing", "/login", "/register", "/choose-plan", "/module-select", "/privacy-policy", "/terms-of-service", "/about", "/contact", "/user-guide", "/features", "/pricing", "/ecommerce-pricing", "/accounting-pricing", "/delivery-pricing", "/food-delivery-pricing", "/sign/", "/supplier-portal", "/share/", "/shared/", "/upload/", "/external-register", "/external-board", "/delivery-sign/", "/loyalty/signup"];
  const isPublic = publicPaths.some(p => location.startsWith(p));

  useEffect(() => {
    if (!loading && user && (user as any).role === "client_external") {
      if (!location.startsWith("/etax-hub/") && !location.startsWith("/login") && !location.startsWith("/shared/") && !location.startsWith("/external-")) {
        setLocation("/etax-hub/board");
      }
      return;
    }
    const ADMIN_ROLES = ["super_admin", "admin", "manager"];
    if (!loading && user && !isPublic && user.subscription?.trialExpired && !ADMIN_ROLES.includes(user.role)) {
      setLocation("/choose-plan");
    }
  }, [loading, user, location, isPublic]);

  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();
  if (location.startsWith("/loyalty/signup")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoyaltySignup />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <TrialGuard>
    <Switch>
      <Route path="/landing" component={LandingPage} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/user-guide" component={UserGuide} />
      <Route path="/ecommerce-pricing" component={EcommercePricing} />
      <Route path="/accounting-pricing" component={AccountingPricing} />
      <Route path="/delivery-pricing" component={DeliveryPricing} />
      <Route path="/food-delivery-pricing" component={FoodDeliveryPricing} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/choose-plan" component={ChoosePlanPage} />
      <Route path="/dashboard/analytical" component={DashboardAnalytical} />
      <Route path="/dashboard/ecommerce" component={Dashboard} />
      <Route path="/login" component={Login} />
      <Route path="/platform" component={PlatformDashboard} />
      <Route path="/platform/tenants" component={PlatformTenants} />
      <Route path="/platform/subscriptions" component={PlatformSubscriptions} />
      <Route path="/platform/payment-settings" component={PlatformPaymentSettings} />
      <Route path="/platform/chat" component={ChatManagement} />
      <Route path="/platform/db-servers" component={DatabaseServers} />
      <Route path="/platform/db-switch" component={DatabaseSwitch} />
      <Route path="/platform/backup" component={DatabaseBackup} />
      <Route path="/platform/maintenance" component={PlatformMaintenance} />
      <Route path="/dev/pdf-stress-test" component={PdfStressTest} />
      <Route path="/platform/passwords" component={PasswordManagement} />
      <Route path="/platform/download-source" component={DownloadSource} />
      <Route path="/journal" component={Journal} />
      <Route path="/journal/new" component={JournalForm} />
      <Route path="/journal/edit/:id" component={JournalForm} />
      <Route path="/journal/print/:id" component={JournalPrint} />
      <Route path="/coa" component={Coa} />
      <Route path="/accounting-mgmt" component={AccountingMgmt} />
      <Route path="/accounting-mgmt/vat-closing" component={VatClosing} />
      <Route path="/accounting-mgmt/balance-carry-forward" component={BalanceCarryForward} />
      <Route path="/accounting-mgmt/trial-balance-compare" component={TrialBalanceCompare} />
      <Route path="/accounting-mgmt/trim-data" component={TrimData} />
      <Route path="/accounting-mgmt/journal-validation" component={JournalValidation} />
      <Route path="/accounting-mgmt/duplicate-detection" component={DuplicateDetection} />
      <Route path="/accounting-mgmt/period-closing" component={PeriodClosing} />
      <Route path="/accounting-mgmt/clean-zero" component={CleanZero} />
      <Route path="/accounting-mgmt/fix-diff" component={FixDiff} />
      <Route path="/accounting-mgmt/change-anchor" component={ChangeAnchor} />
      <Route path="/accounting-mgmt/gl-no-doc" component={GlNoDoc} />
      <Route path="/accounting-mgmt/orphan-journal" component={OrphanJournal} />
      <Route path="/restaurant-pos" component={RestaurantPosIndex} />
      <Route path="/restaurant-pos/order/:id" component={RestaurantOrder} />
      <Route path="/restaurant-pos/kitchen" component={KitchenDisplay} />
      <Route path="/restaurant-pos/table-settings" component={TableSettings} />
      <Route path="/restaurant-pos/menu-settings" component={MenuSettingsPage} />
      <Route path="/accounting-config" component={AccountingConfig} />
      <Route path="/petty-cash" component={PettyCash} />
      <Route path="/finance/due-calendar" component={DueCalendar} />
      <Route path="/finance/cash-flow-forecast" component={CashFlowForecast} />
      <Route path="/finance/receipt-billing" component={ReceiptBilling} />
      <Route path="/finance/billing-notes" component={BillingNotes} />
      <Route path="/finance/billing-notes/pdf/:id" component={BillingNotePdf} />
      <Route path="/finance/ap-billing" component={APBilling} />
      <Route path="/finance/payments" component={FinancePayments} />
      <Route path="/sales/pipeline" component={SalesPipeline} />
      <Route path="/sales/quote" component={QuotationList} />
      <Route path="/sales/quote/new" component={QuotationForm} />
      <Route path="/sales/quote/edit/:id" component={QuotationForm} />
      <Route path="/sales/quote/pdf/:id" component={QuotationPdf} />
      <Route path="/share/quote/:token" component={QuotationShare} />
      <Route path="/sales/order" component={SalesOrderList} />
      <Route path="/sales/order/new" component={SalesOrderForm} />
      <Route path="/sales/order/edit/:id" component={SalesOrderForm} />
      <Route path="/sales/order/pdf/:id" component={SalesOrderPdf} />
      <Route path="/share/order/:token" component={SalesOrderShare} />
      <Route path="/sales/invoice" component={InvoiceList} />
      <Route path="/sales/invoice/new" component={InvoiceForm} />
      <Route path="/sales/invoice/edit/:id" component={InvoiceForm} />
      <Route path="/sales/invoice/import" component={InvoiceImport} />
      <Route path="/sales/invoice/pdf/:id" component={InvoicePdf} />
      <Route path="/share/invoice/:token" component={InvoiceShare} />
      <Route path="/sales/tax-invoice" component={TaxInvoiceList} />
      <Route path="/sales/tax-invoice/new" component={TaxInvoiceForm} />
      <Route path="/sales/tax-invoice/edit/:id" component={TaxInvoiceForm} />
      <Route path="/sales/tax-invoice/pdf/:id" component={TaxInvoicePdf} />
      <Route path="/sales/tax-invoice/batch-print" component={TaxInvoiceBatchPrint} />
      <Route path="/share/tax-invoice/:token" component={TaxInvoiceShare} />
      <Route path="/sales/etax-sent" component={EtaxSentList} />
      <Route path="/sales/receipt" component={ReceiptList} />
      <Route path="/sales/receipt/new" component={ReceiptForm} />
      <Route path="/sales/receipt/edit/:id" component={ReceiptForm} />
      <Route path="/sales/receipt/pdf/:id" component={ReceiptPdf} />
      <Route path="/share/receipt/:token" component={ReceiptShare} />
      <Route path="/sales/credit-note" component={CreditNoteList} />
      <Route path="/sales/credit-note/new" component={CreditNoteForm} />
      <Route path="/sales/credit-note/edit/:id" component={CreditNoteForm} />
      <Route path="/sales/deposit" component={DepositList} />
      <Route path="/sales/deposit/new" component={DepositForm} />
      <Route path="/sales/deposit/edit/:id" component={DepositForm} />
      <Route path="/sales/tax-report" component={SalesTaxReport} />
      <Route path="/purchases/pr" component={PurchaseRequestList} />
      <Route path="/purchases/pr/new" component={PurchaseRequest} />
      <Route path="/purchases/pr/edit/:id" component={PurchaseRequest} />
      <Route path="/purchases/bid" component={BidComparisonList} />
      <Route path="/purchases/bid/new" component={BidComparison} />
      <Route path="/purchases/bid/edit/:id" component={BidComparison} />
      <Route path="/purchases/po" component={PurchaseOrderList} />
      <Route path="/purchases/po/new" component={PurchaseOrder} />
      <Route path="/purchases/po/edit/:id" component={PurchaseOrder} />
      <Route path="/purchases/invoice" component={PurchaseInvoiceList} />
      <Route path="/purchases/ap/new" component={PurchaseInvoice} />
      <Route path="/purchases/ap/edit/:id" component={PurchaseInvoice} />
      <Route path="/purchases/ap/import" component={PurchaseImport} />
      <Route path="/purchases/ap/pdf-import" component={PurchasePdfImport} />
      <Route path="/purchases/expense" component={ExpenseList} />
      <Route path="/purchases/expenses" component={ExpenseList} />
      <Route path="/purchases/exp/new" component={ExpenseEntry} />
      <Route path="/purchases/exp/edit/:id" component={ExpenseEntry} />
      <Route path="/purchases/exp/import" component={ExpenseImport} />
      <Route path="/purchases/exp/pdf-import" component={ExpensePdfImport} />
      <Route path="/purchases/pdf-bulk-import" component={PdfBulkImport} />
      <Route path="/purchases/tax-report" component={PurchaseTaxReport} />
      <Route path="/purchases/wht" component={WhtCertList} />
      <Route path="/purchases/wht/new" component={WhtCertForm} />
      <Route path="/purchases/wht/edit/:id" component={WhtCertForm} />
      <Route path="/purchases/wht/print/:id" component={WhtCertPrint} />
      <Route path="/purchases/wht/attachment" component={WhtAttachmentPrint} />
      <Route path="/purchases/debit-note" component={DebitNoteList} />
      <Route path="/purchases/debit-note/new" component={DebitNoteForm} />
      <Route path="/purchases/debit-note/edit/:id" component={DebitNoteForm} />
      <Route path="/purchases/purchase-deposit" component={PurchaseDepositList} />
      <Route path="/purchases/purchase-deposit/new" component={PurchaseDepositForm} />
      <Route path="/purchases/purchase-deposit/edit/:id" component={PurchaseDepositForm} />
      <Route path="/share/wht-cert/:token" component={WhtCertShare} />
      <Route path="/shared/board/:token">{() => <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-[#fb9678] border-t-transparent rounded-full" /></div>}><SharedBoardPage /></Suspense>}</Route>
      <Route path="/external-register">{() => <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-[#fb9678] border-t-transparent rounded-full" /></div>}><ExternalRegisterPage /></Suspense>}</Route>
      <Route path="/external-board">{() => <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-[#fb9678] border-t-transparent rounded-full" /></div>}><ExternalBoardPage /></Suspense>}</Route>
      <Route path="/contacts/list" component={ContactList} />
      <Route path="/contacts/new" component={ContactForm} />
      <Route path="/contacts/edit/:id" component={ContactForm} />
      <Route path="/contacts/history" component={ContactHistory} />
      <Route path="/contacts/settings" component={ContactSettings} />
      <Route path="/inventory/list" component={InventoryList} />
      <Route path="/inventory/list/new" component={ProductForm} />
      <Route path="/inventory/list/edit/:id" component={ProductForm} />
      <Route path="/inventory/bom" component={BomManagement} />
      <Route path="/inventory/bom/new" component={BomFormPage} />
      <Route path="/inventory/bom/edit/:id" component={BomFormPage} />
      <Route path="/inventory/bundles" component={BundleManagement} />
      <Route path="/inventory/bundles/edit/:id" component={BundleFormPage} />
      <Route path="/inventory/promotions" component={PromotionManagement} />
      <Route path="/inventory/promotions/new" component={PromotionFormPage} />
      <Route path="/inventory/promotions/edit/:id" component={PromotionFormPage} />
      <Route path="/inventory/product-mapping" component={ProductMapping} />
      <Route path="/inventory/product-mapping/new" component={MappingFormPage} />
      <Route path="/inventory/product-mapping/edit/:id" component={MappingFormPage} />
      <Route path="/inventory/warehouse" component={WarehousePage} />
      <Route path="/inventory/stock-card" component={StockCardPage} />
      <Route path="/inventory/stock-transfer" component={StockTransferPage} />
      <Route path="/inventory/reports/valuation" component={InventoryValuation} />
      <Route path="/inventory/reports/movement-summary" component={MovementSummary} />
      <Route path="/inventory/reports/slow-moving" component={SlowMoving} />
      <Route path="/inventory/receiving" component={GoodsReceivingList} />
      <Route path="/inventory/receiving/form" component={GoodsReceivingForm} />
      <Route path="/inventory/receiving/form/:id" component={GoodsReceivingForm} />
      <Route path="/inventory/lots" component={ProductLotsPage} />
      <Route path="/inventory/manufacturing" component={ManufacturingList} />
      <Route path="/inventory/manufacturing/form" component={ManufacturingForm} />
      <Route path="/inventory/manufacturing/form/:id" component={ManufacturingForm} />
      <Route path="/inventory/requisition" component={GoodsRequisitionList} />
      <Route path="/inventory/requisition/form" component={GoodsRequisitionForm} />
      <Route path="/inventory/requisition/form/:id" component={GoodsRequisitionForm} />
      <Route path="/inventory/import-export" component={ProductImportExport} />
      <Route path="/inventory/barcode-labels" component={BarcodeLabels} />
      <Route path="/assets/registry" component={AssetRegistry} />
      <Route path="/assets/form" component={AssetForm} />
      <Route path="/assets/form/:id" component={AssetForm} />
      <Route path="/assets/depreciation" component={DepreciationPage} />
      <Route path="/assets/sales" component={AssetSalesReport} />
      <Route path="/assets/expired" component={AssetExpiredReport} />
      <Route path="/assets/summary" component={AssetSummary} />
      <Route path="/assets/history" component={AssetAccountingHistory} />
      <Route path="/assets/installments" component={InstallmentContracts} />
      <Route path="/assets/categories" component={AssetCategories} />
      <Route path="/reports/general" component={GeneralReports} />
      <Route path="/reports/general-ledger" component={GeneralLedger} />
      <Route path="/reports/journal-book" component={JournalBookReport} />
      <Route path="/reports/trial-balance" component={TrialBalance} />
      <Route path="/reports/income-statement" component={IncomeStatement} />
      <Route path="/reports/balance-sheet" component={BalanceSheet} />
      <Route path="/reports/cash-flow" component={CashFlowStatement} />
      <Route path="/reports/account-statement" component={AccountStatementPage} />
      <Route path="/reports/account-statement-contact" component={AccountStatementContactPage} />
      <Route path="/reports/reconcile-account-type" component={ReconcileAccountTypePage} />
      <Route path="/reports/worksheet" component={WorksheetPage} />
      <Route path="/reports/accounting-log" component={AccountingLogPage} />
      <Route path="/reports/purchase-tax-pending" component={PurchaseTaxPendingPage} />
      <Route path="/reports/pnd3" component={Pnd3Page} />
      <Route path="/reports/pnd53" component={Pnd53Page} />
      <Route path="/reports/sales-tax-reconcile">{() => <TaxReconcilePage type="sales" />}</Route>
      <Route path="/reports/purchase-tax-reconcile">{() => <TaxReconcilePage type="purchase" />}</Route>
      <Route path="/reports/vat-pp30-from-tb" component={VatPp30FromTbPage} />
      <Route path="/reports/income-statement-compare" component={IncomeStatementCompare} />
      <Route path="/reports/balance-sheet-compare" component={BalanceSheetCompare} />
      <Route path="/reports/balance-sheet-compare-amount" component={BalanceSheetCompareAmount} />
      <Route path="/reports/balance-sheet-12month-chart" component={BalanceSheet12MonthChart} />
      <Route path="/reports/income-statement-compare-amount" component={IncomeStatementCompareAmount} />
      <Route path="/reports/income-statement-12month" component={IncomeStatement12Month} />
      <Route path="/reports/income-statement-12month-chart" component={IncomeStatement12MonthChart} />
      <Route path="/reports/income-statement-cumulative" component={IncomeStatementCumulative} />
      <Route path="/reports/income-statement-month-year" component={IncomeStatementMonthYear} />
      <Route path="/reports/income-statement-pct" component={IncomeStatementPct} />
      <Route path="/reports/income-statement-quarterly" component={IncomeStatementQuarterly} />
      <Route path="/reports/financial-notes" component={FinancialNotes} />
      <Route path="/tax-tools/financial-statements-package" component={FinancialStatementsPackage} />
      <Route path="/reports/financial-statements-package">{() => { window.location.href = "/tax-tools/financial-statements-package"; return null; }}</Route>
      <Route path="/reports/ar-aging" component={ARAgingReport} />
      <Route path="/reports/ar-aging-invoices" component={ARAgingInvoicesReport} />
      <Route path="/reports/ap-aging" component={APAgingReport} />
      <Route path="/reports/financial-ratios" component={FinancialRatiosDashboard} />
      <Route path="/reports/budget-entry" component={BudgetEntry} />
      <Route path="/reports/budget-vs-actual" component={BudgetVsActual} />
      <Route path="/reports/vat-pp30" component={VatPP30Report} />
      <Route path="/reports/bank-reconciliation" component={BankReconciliation} />
      <Route path="/reports/sales" component={SalesReport} />
      <Route path="/reports/gross-profit" component={GrossProfitReport} />
      <Route path="/reports/sales-by-document" component={SalesByDocument} />
      <Route path="/reports/sales-by-department" component={SalesByDepartment} />
      <Route path="/reports/sales-by-project" component={SalesByProject} />
      <Route path="/reports/sales-by-account" component={SalesByAccount} />
      <Route path="/reports/sales-item-details" component={SalesItemDetails} />
      <Route path="/reports/daily-sales" component={DailySalesSummary} />
      <Route path="/reports/top-products" component={TopProducts} />
      <Route path="/reports/sales-monthly-comparison" component={SalesMonthlyComparison} />
      <Route path="/reports/gross-profit-by-product" component={GrossProfitByProduct} />
      <Route path="/reports/opex-capex" component={OpexCapexReport} />
      <Route path="/reports/growth-trend" component={GrowthTrendReport} />
      <Route path="/reports/department-pl" component={DepartmentPLReport} />
      <Route path="/reports/break-even" component={BreakEvenReport} />
      <Route path="/reports/financial-management" component={FinancialManagement} />
      <Route path="/reports/wht" component={WhtCertList} />
      <Route path="/firm-mgmt/clients" component={FirmManagement} />
      <Route path="/firm-mgmt/assignments" component={FirmAssignments} />
      <Route path="/firm-mgmt/contracts" component={ContractsPage} />
      <Route path="/firm-mgmt/billing" component={FirmBilling} />
      <Route path="/firm-mgmt/documents" component={FirmDocuments} />
      <Route path="/line-document-archive" component={LineDocumentArchive} />
      <Route path="/sign/:token" component={ContractSignPage} />
      <Route path="/delivery-sign/:token" component={DeliverySignPublicPage} />
      <Route path="/hr/dashboard" component={HRMDashboard} />
      <Route path="/hr/attendance" component={HRAttendance} />
      <Route path="/hr/attendance-report" component={AttendanceReport} />
      <Route path="/hr/employees" component={EmployeeList} />
      <Route path="/hr/leave" component={LeaveManagement} />
      <Route path="/hr/leave-policy" component={LeavePolicySettings} />
      <Route path="/hr/ot" component={OTManagement} />
      <Route path="/hr/payroll">{() => { window.location.href = "/hr/payslip"; return null; }}</Route>
      <Route path="/hr/payslip" component={PayslipPage} />
      <Route path="/hr/certificates" component={Certificates} />
      <Route path="/hr/salary-certificate">{() => { window.location.href = "/hr/certificates"; return null; }}</Route>
      <Route path="/hr/work-certificate">{() => { window.location.href = "/hr/certificates?tab=work"; return null; }}</Route>
      <Route path="/hr/holidays" component={HolidaysPage} />
      <Route path="/hr/work-schedule" component={WorkSchedulePage} />
      <Route path="/hr/shift-settings" component={ShiftSettingsPage} />
      <Route path="/hr/shift-schedule" component={ShiftSchedulePage} />
      <Route path="/hr/scanner-mapping" component={ScannerMapping} />
      <Route path="/hr/scanner-import" component={ScannerImport} />
      <Route path="/hr/payroll-tax" component={PayrollTax} />
      <Route path="/hr/wht-import" component={WhtImport} />
      <Route path="/tax-tools/wht-import" component={WhtImport} />
      <Route path="/tax-tools/financial-statements" component={FinancialStatementsGenerator} />
      <Route path="/tax-tools/gov-receipt" component={GovReceiptDownloader} />
      <Route path="/tax-tools">{() => { window.location.href = "/tax-tools/financial-statements"; return null; }}</Route>
      <Route path="/tools/gov-receipt" component={GovReceiptDownloader} />
      <Route path="/hr/performance" component={Performance} />
      <Route path="/hr/commission-rules" component={CommissionRules} />
      <Route path="/hr/commission" component={CommissionRecords} />
      <Route path="/hr/pnd1">{() => { window.location.href = "/hr/payroll-tax?tab=pnd1"; return null; }}</Route>
      <Route path="/hr/pnd1a">{() => { window.location.href = "/hr/payroll-tax?tab=pnd1a"; return null; }}</Route>
      <Route path="/hr/tax-attachment">{() => { window.location.href = "/hr/payroll-tax?tab=attachment"; return null; }}</Route>
      <Route path="/hr/fifty-tawi">{() => { window.location.href = "/hr/payroll-tax?tab=50tawi"; return null; }}</Route>
      <Route path="/ess" component={UserProfile} />
      <Route path="/etax-hub" component={EtaxHubDashboard} />
      <Route path="/etax-hub/board" component={EtaxHubClientBoard} />
      <Route path="/etax-hub/calendar" component={EtaxHubMyCalendar} />
      <Route path="/settings/tax-reminder" component={TaxReminderSettings} />
      <Route path="/office/tasks" component={TaskBoardPage} />
      <Route path="/office/work-board" component={WorkBoardPage} />
      <Route path="/settings/users" component={UserManagement} />
      <Route path="/settings/document-templates" component={DocumentTemplates} />
      <Route path="/settings/profile" component={UserProfile} />
      <Route path="/settings/firm-link" component={FirmLinkPage} />
      <Route path="/module-select" component={ModuleSelectPage} />
      <Route path="/settings/company-info" component={CompanyInfo} />
      <Route path="/settings/payment-methods" component={PaymentMethodSettings} />
      <Route path="/settings/my-subscription" component={MySubscription} />
      <Route path="/settings/upgrade" component={UpgradePlan} />
      <Route path="/settings/white-label" component={WhiteLabelSettings} />
      <Route path="/settings/landing-cms" component={LandingCmsPage} />
      <Route path="/settings/ftp-archive" component={FtpArchiveSettings} />
      <Route path="/settings/etax" component={EtaxSettings} />
      <Route path="/settings/line" component={LineSettings} />
      <Route path="/settings/approval" component={ApprovalSettingsPage} />
      <Route path="/settings/general" component={GeneralSettings} />
      <Route path="/settings/dept-branch" component={DeptBranchSettings} />
      <Route path="/accounting/formulas" component={AccountingFormulas} />
      <Route path="/ecommerce/dashboard" component={EcommerceDashboard} />
      <Route path="/ecommerce/hub" component={EcommerceHub} />
      <Route path="/ecommerce/connections" component={EcommerceConnections} />
      <Route path="/ecommerce/import" component={OrderImport} />
      <Route path="/ecommerce/grab-food" component={GrabFoodConnect} />
      <Route path="/ecommerce/orders" component={EcommerceOrders} />
      <Route path="/ecommerce/documents" component={EcommerceDocuments} />
      <Route path="/ecommerce/quick-invoice" component={EcommerceQuickInvoice} />
      <Route path="/ecommerce/inventory/bom" component={EcommerceInventoryBom} />
      <Route path="/ecommerce/inventory/manufacturing" component={EcommerceInventoryManufacturing} />
      <Route path="/ecommerce/inventory/bundles" component={EcommerceInventoryBundles} />
      <Route path="/ecommerce/inventory/promotions" component={EcommerceInventoryPromotions} />
      <Route path="/ecommerce/inventory/warehouse" component={EcommerceInventoryWarehouse} />
      <Route path="/ecommerce/inventory/stock-card" component={EcommerceInventoryStockCard} />
      <Route path="/ecommerce/inventory/valuation" component={EcommerceInventoryValuation} />
      <Route path="/ecommerce/inventory/movement" component={EcommerceInventoryMovement} />
      <Route path="/ecommerce/inventory/slow-moving" component={EcommerceInventorySlowMoving} />
      <Route path="/ecommerce/inventory/stock-sync" component={EcommerceStockSync} />
      <Route path="/ecommerce/sku-mapping" component={SkuSmartMapping} />
      <Route path="/ecommerce/warehouses" component={EcommerceWarehouses} />
      <Route path="/ecommerce/fulfillment" component={EcommerceFulfillment} />
      <Route path="/ecommerce/shipping-labels" component={EcommerceShippingLabels} />
      <Route path="/ecommerce/packing-cameras" component={EcommercePackingCameras} />
      <Route path="/ecommerce/ai-analytics" component={EcommerceAiAnalytics} />
      <Route path="/ecommerce/supplier-portal" component={EcommerceSupplierPortal} />
      <Route path="/upload/:token" component={ClientUploadPage} />
      <Route path="/ecommerce/pda-mobile" component={EcommercePdaMobile} />
      <Route path="/ecommerce/bin-locations" component={EcommerceBinLocations} />
      <Route path="/ecommerce/packing-station" component={EcommercePackingStation} />
      <Route path="/ecommerce/packing-recordings" component={EcommercePackingRecordings} />
      <Route path="/ecommerce/wave-picking" component={EcommerceWavePicking} />
      <Route path="/ecommerce/settlements" component={EcommerceSettlements} />
      <Route path="/ecommerce/settlement-import" component={SettlementImport} />
      <Route path="/ecommerce/withdrawal-import" component={WithdrawalImport} />
      <Route path="/ecommerce/returns" component={EcommerceReturns} />
      <Route path="/ecommerce/returns-report" component={EcommerceReturnsReport} />
      <Route path="/ecommerce/returns-scan" component={EcommerceReturnsScan} />
      <Route path="/ecommerce/returns-qc" component={EcommerceReturnsQC} />
      <Route path="/ecommerce/analytics" component={EcommerceAnalytics} />
      <Route path="/ecommerce/auto-sync" component={EcommerceAutoSync} />
      <Route path="/ecommerce/platform-credentials" component={PlatformCredentials} />
      <Route path="/ecommerce/chat" component={EcommerceChatInbox} />
      <Route path="/ecommerce/chat/auto-reply" component={EcommerceChatAutoReply} />
      <Route path="/ecommerce/chat/keywords" component={EcommerceChatKeywords} />
      <Route path="/ecommerce/api-connect" component={EcommerceApiConnect} />
      <Route path="/ecommerce/facebook-orders" component={EcommerceFacebookOrders} />
      <Route path="/ecommerce/stock-alerts" component={EcommerceStockAlerts} />
      <Route path="/ecommerce/reconciliation" component={EcommerceReconciliation} />
      <Route path="/ecommerce/store-clone" component={EcommerceStoreClone} />
      <Route path="/ecommerce/settings" component={EcommerceSettings} />
      <Route path="/ecommerce/price-calculator" component={PriceCalculator} />
      <Route path="/ecommerce/business-insights" component={BusinessInsights} />
      <Route path="/ecommerce/inventory" component={EcommerceInventory} />
      <Route path="/ecommerce/live-selling" component={LiveSellingHub} />
      <Route path="/ecommerce/live-selling/dashboard" component={LiveSellingDashboard} />
      <Route path="/ecommerce/live-selling/lucky-draw" component={LiveSellingLuckyDraw} />
      <Route path="/ecommerce/live-agency" component={AgencyDashboard} />
      <Route path="/ecommerce/live-agency/monitor/:id" component={LiveMonitor} />
      <Route path="/ecommerce/live-agency/report/:id" component={PostLiveReport} />
      <Route path="/ecommerce/live-agency/planning" component={LivePlanning} />
      <Route path="/delivery/dashboard" component={DeliveryDashboard} />
      <Route path="/delivery/fulfillment" component={DeliveryFulfillment} />
      <Route path="/delivery/shipping-labels" component={DeliveryShippingLabels} />
      <Route path="/delivery/tracking" component={DeliveryTracking} />
      <Route path="/delivery/line-notify" component={DeliveryLineNotify} />
      <Route path="/delivery/shipments" component={DeliveryShipments} />
      <Route path="/delivery/scan" component={DeliveryScan} />
      <Route path="/delivery/settings" component={DeliverySettings} />
      <Route path="/delivery-notes" component={DeliveryNotesPage} />
      <Route path="/delivery-notes/new" component={DeliveryNoteFormPage} />
      <Route path="/delivery-notes/:id" component={DeliveryNoteFormPage} />
      <Route path="/food-delivery/dashboard" component={FoodDashboard} />
      <Route path="/food-delivery/orders" component={FoodOrders} />
      <Route path="/food-delivery/menu" component={FoodMenu} />
      <Route path="/food-delivery/connections" component={FoodConnections} />
      <Route path="/food-delivery/stores" component={FoodStores} />
      <Route path="/food-delivery/analytics" component={FoodAnalytics} />
      <Route path="/food-delivery/history" component={FoodHistory} />
      <Route path="/food-delivery/import" component={FoodImport} />
      <Route path="/food-delivery/accounting" component={FoodAccounting} />
      <Route path="/food-delivery/settings" component={FoodSettings} />
      <Route path="/pos/terminal" component={PosTerminal} />
      <Route path="/pos/dashboard" component={PosDashboard} />
      <Route path="/pos/sessions" component={PosSessions} />
      <Route path="/pos/branches" component={PosBranches} />
      <Route path="/pos/sales" component={PosSalesList} />
      <Route path="/pos/invoice/:id" component={PosInvoice} />
      <Route path="/pos/receipt/:id" component={PosReceipt} />
      <Route path="/pos/loyalty" component={LoyaltyManagement} />
      <Route path="/pos-hub" component={PosHubDashboard} />
      <Route path="/pos-hub/dashboard" component={PosHubDashboard} />
      <Route path="/pos-hub/sales-by-branch" component={PosHubSalesByBranch} />
      <Route path="/pos-hub/sales-by-product" component={PosHubSalesByProduct} />
      <Route path="/pos-hub/sales-by-category" component={PosHubSalesByCategory} />
      <Route path="/pos-hub/best-sellers" component={PosHubBestSellers} />
      <Route path="/pos-hub/payment-analysis" component={PosHubPaymentAnalysis} />
      <Route path="/pos-hub/cashier-performance" component={PosHubCashierPerformance} />
      <Route path="/pos-hub/hourly-trends" component={PosHubHourlyTrends} />
      <Route path="/pos-hub/daily-summary" component={PosHubDailySummary} />
      <Route path="/pos/list" component={PosProducts} />
      <Route path="/pos/list/new" component={PosProductForm} />
      <Route path="/pos/list/edit/:id" component={PosProductForm} />
      <Route path="/pos/products" component={PosProducts} />
      <Route path="/pos/bundles" component={PosBundles} />
      <Route path="/pos/bundles/edit/:id" component={PosBundleForm} />
      <Route path="/pos/stock" component={PosStock} />
      <Route path="/pos/stock-card" component={PosStockCard} />
      <Route path="/pos/tax-invoices" component={PosTaxInvoices} />
      <Route path="/pos/settings" component={PosSettings} />
      <Route path="/loyalty/signup" component={LoyaltySignup} />
      <Route path="/job-costing" component={JobCostingProjectList} />
      <Route path="/job-costing/projects/:id" component={JobCostingProjectDetail} />
      <Route path="/gas-station/setup" component={GasFuelSetup} />
      <Route path="/gas-station/integration" component={GasStationIntegration} />
      <Route path="/gas-station/dashboard" component={GasStationDashboard} />
      <Route path="/gas-station/daily-sales" component={GasDailySales} />
      <Route path="/gas-station/fuel-stock" component={GasFuelStock} />
      <Route path="/gas-station/oil-loss-gain" component={GasOilLossGain} />
      <Route path="/gas-station/local-tax" component={GasLocalTax} />
      <Route path="/gas-station/reports" component={GasReports} />
      <Route path="/approval-center" component={ApprovalCenter} />
      <Route path="/approve/:token" component={ApproveByTokenPage} />
      <Route path="/activity-log" component={ActivityLog} />
      <Route path="/system-info" component={SystemInfo} />
      <Route path="/crm/customers" component={CustomerList} />
      <Route path="/crm/customers/:id" component={CustomerDetail} />
      <Route path="/ads/tracking" component={AdTracking} />
      <Route path="/ci/executive" component={CIExecutive} />
      <Route path="/ci/channel" component={CIChannel} />
      <Route path="/ci/product" component={CIProduct} />
      <Route path="/ci/campaign" component={CICampaign} />
      <Route path="/ci/live" component={CILive} />
      <Route path="/ci/alerts" component={CIAlerts} />
      <Route path="/office/chat" component={InternalChat} />
      <Route path="/office/meetings" component={MeetingsPage} />
      <Route path="/office/calendar" component={FullCalendar} />
      <Route path="/m/dashboard" component={MobileExecutiveDashboard} />
      <Route path="/m/expense-snap" component={MobileExpenseSnap} />
      <Route path="/legacy-import/login" component={LegacyLoginPage} />
      <Route path="/legacy-import/documents/type/:docType" component={LegacyDocumentsPage} />
      <Route path="/legacy-import/documents/:id" component={LegacyDocumentsPage} />
      <Route path="/legacy-import" component={LegacyImportPage} />
      <Route path="/legacy-import/import-db" component={LegacyImportDbPage} />
      <Route path="/legacy-import/viewer" component={LegacyViewerPage} />
      <Route path="/legacy-import/company-manager" component={LegacyCompanyManagerPage} />
      <Route path="/legacy-import/chart-of-accounts" component={LegacyChartOfAccountsPage} />
      <Route path="/legacy-import/contacts" component={LegacyContactsPage} />
      <Route path="/legacy-import/gl-journal/:id" component={LegacyGlJournalPage} />
      <Route path="/legacy-import/gl-journal" component={LegacyGlJournalPage} />
      <Route path="/legacy-import/reports/trial-balance" component={LegacyReportsPage} />
      <Route path="/legacy-import/reports/general-ledger" component={LegacyReportsPage} />
      <Route path="/legacy-import/reports/income-statement" component={LegacyReportsPage} />
      <Route path="/legacy-import/reports/balance-sheet" component={LegacyReportsPage} />
      <Route path="/legacy-import/reports/tax-summary" component={LegacyReportsPage} />
      <Route path="/dashboard" component={DashboardRedirect} />
      <Route path="/" component={HomeRedirect} />
      <Route component={NotFound} />
    </Switch>
    </TrialGuard>
    </Suspense>
  );
}

function UpgradePrompt() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [, navigate] = useLocation();

  useEffect(() => {
    setUpgradeCallback((message: string) => {
      setMsg(message);
      setOpen(true);
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <span className="text-lg">⚠️</span> เกินขีดจำกัดแพ็คเกจ
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed">{msg}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>ปิด</Button>
          <Button
            style={{ background: "#fb9678" }}
            onClick={() => { setOpen(false); navigate("/settings/upgrade"); }}
            data-testid="button-go-upgrade"
          >
            ดูแพ็คเกจ & อัพเกรด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <CompanyProvider>
              <DateSettingsProvider>
                <Toaster />
                <UpgradePrompt />
                <Router />
                <ExternalUserGuard>
                  <ChatWidget />
                  <InternalChatWidget />
                </ExternalUserGuard>
              </DateSettingsProvider>
            </CompanyProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
