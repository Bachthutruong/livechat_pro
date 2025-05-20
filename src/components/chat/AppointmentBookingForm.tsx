// src/components/chat/AppointmentBookingForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { AppointmentBookingFormData, UserSession, ProductItem, Branch } from '@/lib/types';
import { format, addMinutes, startOfHour, setHours, setMinutes, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { getCustomerListForSelect, getAllProducts, getBranches, getAppSettings, getBookedSlots } from '@/app/actions';

interface AppointmentBookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: AppointmentBookingFormData) => Promise<void>;
  currentUserSession: UserSession | null;
}

const generateTimeSlots = async () => {
  const appSettings = await getAppSettings();
  if (!appSettings?.workingHours || appSettings.workingHours.length === 0) {
    // Fallback to default time slots if no working hours configured
    const slots = [];
    let date = startOfHour(new Date());
    date = setHours(date, 8); // Start from 8 AM
    date = setMinutes(date, 0);
    for (let i = 0; i < 12 * 4; i++) { // Generate slots from 8 AM to 8 PM
      slots.push(format(date, 'HH:mm'));
      date = addMinutes(date, 15);
    }
    return slots;
  }
  return appSettings.workingHours;
};

export function AppointmentBookingForm({ isOpen, onClose, onSubmit, currentUserSession }: AppointmentBookingFormProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [customerList, setCustomerList] = useState<{ id: string, name: string, phoneNumber: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(currentUserSession?.role === 'customer' ? currentUserSession.id : undefined);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [isFullyBooked, setIsFullyBooked] = useState(false);
  const [isDayOff, setIsDayOff] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [fetchedProducts, fetchedBranches, fetchedCustomers, fetchedTimeSlots] = await Promise.all([
            getAllProducts(),
            getBranches(true), // Fetch only active branches
            (currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') ? getCustomerListForSelect() : Promise.resolve([]),
            generateTimeSlots()
          ]);

          const filteredProducts = fetchedProducts.filter(p => p.isActive);
          setProducts(filteredProducts);
          setBranches(fetchedBranches);
          setCustomerList(fetchedCustomers);
          setTimeSlots(fetchedTimeSlots);
          setAvailableTimeSlots(fetchedTimeSlots); // Initialize with all time slots

          // Set default selections if possible
          if (fetchedBranches.length > 0) {
            setSelectedBranchId(fetchedBranches[0].id);
          }

          if (filteredProducts.length > 0) {
            setSelectedProductId(filteredProducts[0].id);
          }

          if (currentUserSession?.role === 'customer') {
            setSelectedCustomerId(currentUserSession.id);
          }

          if (fetchedTimeSlots.length > 0) {
            setTime(fetchedTimeSlots[0]);
          }
        } catch (error) {
          console.error('Error loading initial data:', error);
          toast({ title: "Lỗi tải dữ liệu", description: "Không thể tải danh sách dịch vụ, chi nhánh hoặc khách hàng.", variant: "destructive" });
        }
      };
      fetchData();
    }
  }, [currentUserSession, isOpen, toast]);

  // Check for available time slots when date or branch changes
  useEffect(() => {
    const checkAvailability = async () => {
      if (!selectedDate) {
        setAvailableTimeSlots(timeSlots);
        setIsFullyBooked(false);
        setIsDayOff(false);
        return;
      }

      // Check if it's a day off (e.g., Sunday)
      const dayOfWeek = selectedDate.getDay();
      const isWeekend = dayOfWeek === 0; // Sunday

      if (isWeekend) {
        setIsDayOff(true);
        setIsFullyBooked(false);
        setAvailableTimeSlots([]);
        return;
      }

      try {
        // Get booked slots for this date and branch
        let fetchedBookedSlots: string[] = [];

        if (selectedBranchId) {
          // You need to implement this server action to fetch booked slots
          fetchedBookedSlots = await getBookedSlots(
            format(selectedDate, 'yyyy-MM-dd'),
            selectedBranchId
          );
        }

        setBookedSlots(fetchedBookedSlots);

        // Filter out booked slots
        const available = timeSlots.filter(slot => !fetchedBookedSlots.includes(slot));
        setAvailableTimeSlots(available);

        // Check if all slots are booked
        setIsFullyBooked(available.length === 0);
        setIsDayOff(false);

        // Set default time if current selection is not available
        if (available.length > 0 && (!time || !available.includes(time))) {
          setTime(available[0]);
        }
      } catch (error) {
        console.error('Error checking availability:', error);
        // Fallback to all time slots if there's an error
        setAvailableTimeSlots(timeSlots);
        setIsFullyBooked(false);
        setIsDayOff(false);
      }
    };

    if (timeSlots.length > 0) {
      checkAvailability();
    }
  }, [selectedDate, selectedBranchId, timeSlots, time]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProduct = products.find(p => p.id === selectedProductId);
    const selectedBranch = branches.find(b => b.id === selectedBranchId);

    if (!selectedProduct || !selectedDate || !time || !selectedCustomerId || (branches.length > 0 && !selectedBranch)) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng điền đầy đủ các trường bắt buộc: Dịch vụ, Khách hàng, Ngày, Giờ và Chi nhánh (nếu có).', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const formData: AppointmentBookingFormData = {
      service: selectedProduct.name,
      productId: selectedProduct.id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time,
      branch: selectedBranch?.name,
      branchId: selectedBranch?.id,
      notes: notes.trim() || undefined,
      customerId: selectedCustomerId,
    };
    await onSubmit(formData);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Đặt lịch hẹn trực tiếp</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto p-1">
          {(currentUserSession?.role === 'admin' || currentUserSession?.role === 'staff') && (
            <div className="space-y-2">
              <Label htmlFor="customer" className="text-sm font-medium">Khách hàng <span className="text-destructive">*</span></Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={isSubmitting}>
                <SelectTrigger id="customer" className="w-full">
                  <SelectValue placeholder="Chọn khách hàng" />
                </SelectTrigger>
                <SelectContent>
                  {customerList.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="service" className="text-sm font-medium">Dịch vụ <span className="text-destructive">*</span></Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={isSubmitting || products.length === 0}>
              <SelectTrigger id="service" className="w-full">
                <SelectValue placeholder={products.length === 0 ? "Không có dịch vụ nào" : "Chọn dịch vụ"} />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {branches.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-sm font-medium">Chi nhánh <span className="text-destructive">*</span></Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={isSubmitting}>
                <SelectTrigger id="branch" className="w-full">
                  <SelectValue placeholder="Chọn chi nhánh" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date and Time selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-medium">Ngày <span className="text-destructive">*</span></Label>
              <div className="border rounded-md p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="mx-auto"
                  disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1)) || isSubmitting}
                  locale={vi}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="text-sm font-medium">Giờ <span className="text-destructive">*</span></Label>
              <div className="border rounded-md h-full flex flex-col">
                {isDayOff || isFullyBooked ? (
                  <div className="flex-1 flex items-center justify-center p-4 text-destructive font-medium">
                    Ngừng nhận khách
                  </div>
                ) : availableTimeSlots.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-4 text-muted-foreground">
                    Đang tải khung giờ...
                  </div>
                ) : (
                  <>
                    <Select value={time} onValueChange={setTime} disabled={isSubmitting}>
                      <SelectTrigger id="time" className="w-full border-0 h-10">
                        <SelectValue placeholder="Chọn giờ" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {availableTimeSlots.map(slot => (
                          <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1 p-3 overflow-y-auto">
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableTimeSlots.map(slot => (
                          <Button
                            key={slot}
                            type="button"
                            variant={time === slot ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTime(slot)}
                            disabled={isSubmitting}
                            className="text-xs"
                          >
                            {slot}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Ghi chú (Tùy chọn)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[100px]"
              placeholder="Nhập ghi chú thêm nếu cần..."
            />
          </div>

          <DialogFooter className="sticky bottom-0 bg-background py-4 border-t -mx-1 px-1 mt-6">
            <div className="flex w-full flex-col sm:flex-row justify-end gap-3">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
                  Hủy
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isSubmitting || !selectedProductId || (branches.length > 0 && !selectedBranchId) || isDayOff || isFullyBooked || !time}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? 'Đang xử lý...' : 'Đặt lịch'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
