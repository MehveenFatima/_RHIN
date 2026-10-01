import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AshaWorkerView from "@/components/AshaWorkerView";
import DistrictOfficerView from "@/components/DistrictOfficerView";
import StateOfficerView from "@/components/StateOfficerView";
import { Toaster } from "@/components/ui/sonner";
import { OfflineSyncProvider } from "@/hooks/useOfflineSync";
import Layout from "@/pages/Layout";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <OfflineSyncProvider>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/asha" replace />} />
            <Route path="/asha" element={<AshaWorkerView />} />
            <Route path="/district" element={<DistrictOfficerView />} />
            <Route path="/state" element={<StateOfficerView />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </OfflineSyncProvider>
  </QueryClientProvider>
);

export default App;
