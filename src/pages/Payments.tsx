import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingDown, TrendingUp, Trash2 } from 'lucide-react';
import { patientApi, paymentApi, providerApi, debtApi } from '@/services/api';
import type { Patient, Payment, Provider } from '@/types/api';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CREDIT_CARD', label: 'Tarjeta de Crédito' },
  { value: 'DEBIT_CARD', label: 'Tarjeta de Débito' },
  { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'OTHER', label: 'Otro' },
];

const CURRENCIES = [
  { value: 'UYU', label: '$U - Peso Uruguayo', symbol: '$U' },
  { value: 'USD', label: 'USD - Dólar Americano', symbol: 'USD' },
  { value: 'ARS', label: '$ - Peso Argentino', symbol: '$' },
  { value: 'BRL', label: 'R$ - Real Brasileño', symbol: 'R$' },
  { value: 'EUR', label: '€ - Euro', symbol: '€' },
];

export function Payments() {
  const location = useLocation();
  const preselectedPatientId = location.state?.patientId;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('income');
  
  // Dialogs
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  
  // Forms
  const [incomeForm, setIncomeForm] = useState({
    patientId: '',
    amount: 0,
    method: 'CASH',
    currency: 'UYU',
    concept: '',
    notes: '',
  });
  
  const [expenseForm, setExpenseForm] = useState({
    providerId: '',
    amount: 0,
    method: 'CASH',
    currency: 'UYU',
    concept: '',
    notes: '',
  });

useEffect(() => {
  loadData();
}, []);

useEffect(() => {
  if (preselectedPatientId) {
    setIncomeForm(prev => ({
      ...prev,
      patientId: preselectedPatientId,
    }));
    setIsIncomeDialogOpen(true); // abre el modal automáticamente
  }
}, [preselectedPatientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, patientsRes, providersRes] = await Promise.all([
        paymentApi.list(),
        patientApi.list({ limit: 100 }),
        providerApi.list(),
      ]);
      
      setPayments(paymentsRes.data.data || []);
      setPatients(patientsRes.data.data || []);
      setProviders(providersRes.data || []);
    } catch (error) {
      console.error('Error loading payments data:', error);
      toast.error('Error al cargar datos de pagos');
    } finally {
      setLoading(false);
    }
  };

const handleAddIncome = async () => {
    try {
      // 1. Crear el pago SIEMPRE
      const res = await paymentApi.create({
        ...incomeForm,
        type: 'INCOME',
        paidAt: new Date().toISOString(),
        method: incomeForm.method as any,
        currency: incomeForm.currency as any,
      });

      // 2. Aplicar a deudas si existen
      try {
        let remainingPayment = Number(incomeForm.amount || 0);
        const pendingDebts = (res.data.debts || []).filter(
          (d: any) => d.status === 'PENDING' || d.status === 'PARTIAL'
        );

        for (const debt of pendingDebts) {
          if (remainingPayment <= 0) break;

          const amountToApply = Math.min(
            debt.remainingAmount,
            remainingPayment
          );

          await debtApi.update(debt.id, {
            amountPaid: (debt.amountPaid || 0) + amountToApply,
          });

          remainingPayment -= amountToApply;
        }
      } catch (e) {
        console.error('Error applying payment to debt', e);
      }

      // 3. UI
      toast.success('Ingreso registrado');
      setIsIncomeDialogOpen(false);
      setIncomeForm({
        patientId: '',
        amount: 0,
        method: 'CASH',
        currency: 'UYU',
        concept: '',
        notes: '',
      });

      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al registrar ingreso');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este pago?')) return;
    try {
      await paymentApi.delete(id);
      toast.success('Pago eliminado');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al eliminar pago');
    }
  };

  const getPatientName = (patientId?: string) => {
    if (!patientId) return 'Desconocido';
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Desconocido';
  };

  const getProviderName = (providerId?: string) => {
    if (!providerId) return 'Desconocido';
    const provider = providers.find(p => p.id === providerId);
    return provider ? provider.name : 'Desconocido';
  };

  const getMethodLabel = (method: string) => {
    return PAYMENT_METHODS.find(m => m.value === method)?.label || method;
  };

  const getCurrencySymbol = (currency: string) => {
    return CURRENCIES.find(c => c.value === currency)?.symbol || currency;
  };

  const incomePayments = payments.filter(p => p.type === 'INCOME');
  const expensePayments = payments.filter(p => p.type === 'EXPENSE');
  
  const totalIncome = incomePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalExpense = expensePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = totalIncome - totalExpense;

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Pagos</h1>
        <div className="flex gap-2">
          <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <TrendingUp className="h-4 w-4 mr-2" />
                Ingreso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Ingreso</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Paciente *</Label>
                  <Select
                    value={incomeForm.patientId}
                    onValueChange={(v) => setIncomeForm({ ...incomeForm, patientId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Monto *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={incomeForm.amount || ''}
                      onChange={(e) => setIncomeForm({ ...incomeForm, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda *</Label>
                    <Select
                      value={incomeForm.currency}
                      onValueChange={(v) => setIncomeForm({ ...incomeForm, currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Método *</Label>
                    <Select
                      value={incomeForm.method}
                      onValueChange={(v) => setIncomeForm({ ...incomeForm, method: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Concepto</Label>
                  <Input
                    value={incomeForm.concept}
                    onChange={(e) => setIncomeForm({ ...incomeForm, concept: e.target.value })}
                    placeholder="Ej: Consulta general"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input
                    value={incomeForm.notes}
                    onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  onClick={handleAddIncome}
                  disabled={!incomeForm.patientId || incomeForm.amount <= 0}
                  className="bg-emerald-600"
                >
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <TrendingDown className="h-4 w-4 mr-2" />
                Egreso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Egreso</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Proveedor *</Label>
                  <Select
                    value={expenseForm.providerId}
                    onValueChange={(v) => setExpenseForm({ ...expenseForm, providerId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Monto *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={expenseForm.amount || ''}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda *</Label>
                    <Select
                      value={expenseForm.currency}
                      onValueChange={(v) => setExpenseForm({ ...expenseForm, currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Método *</Label>
                    <Select
                      value={expenseForm.method}
                      onValueChange={(v) => setExpenseForm({ ...expenseForm, method: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Concepto</Label>
                  <Input
                    value={expenseForm.concept}
                    onChange={(e) => setExpenseForm({ ...expenseForm, concept: e.target.value })}
                    placeholder="Ej: Compra de insumos"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  onClick={handleAddExpense}
                  disabled={!expenseForm.providerId || expenseForm.amount <= 0}
                  variant="destructive"
                >
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">${Number(totalIncome || 0).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Egresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${Number(totalExpense || 0).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              ${Number(balance || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="income">
            <TrendingUp className="h-4 w-4 mr-2" />
            Ingresos ({incomePayments.length})
          </TabsTrigger>
          <TabsTrigger value="expense">
            <TrendingDown className="h-4 w-4 mr-2" />
            Egresos ({expensePayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomePayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        No hay ingresos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    incomePayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(parseISO(payment.paidAt), 'dd MMM yyyy', { locale: es })}</TableCell>
                        <TableCell>{getPatientName(payment.patientId)}</TableCell>
                        <TableCell>{payment.concept || '-'}</TableCell>
                        <TableCell>{getMethodLabel(payment.method)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCurrencySymbol(payment.currency || 'UYU')}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-emerald-600">+{Number(payment.amount || 0).toFixed(2)}</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(payment.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expense" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensePayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        No hay egresos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    expensePayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(parseISO(payment.paidAt), 'dd MMM yyyy', { locale: es })}</TableCell>
                        <TableCell>{getProviderName(payment.providerId)}</TableCell>
                        <TableCell>{payment.concept || '-'}</TableCell>
                        <TableCell>{getMethodLabel(payment.method)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCurrencySymbol(payment.currency || 'UYU')}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-red-600">-{Number(payment.amount || 0).toFixed(2)}</span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(payment.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
