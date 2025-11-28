import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';

type CheckoutStep = 'shipping' | 'payment' | 'review' | 'confirmation';

const Checkout = () => {
  const navigate = useNavigate();
  const { items, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState<CheckoutStep>('shipping');
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    email: user?.email || '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  });

  const [shippingMethod, setShippingMethod] = useState('standard');

  const shippingOptions = [
    { id: 'standard', name: 'Standard Shipping', price: 0, duration: '5-7 business days' },
    { id: 'express', name: 'Express Shipping', price: 15, duration: '2-3 business days' },
    { id: 'overnight', name: 'Overnight Shipping', price: 30, duration: '1 business day' },
  ];

  const selectedShipping = shippingOptions.find(opt => opt.id === shippingMethod);
  const finalTotal = totalAmount + (selectedShipping?.price || 0);

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('review');
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error('Please sign in to place an order');
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          total_price: finalTotal,
          status: 'pending',
          configuration_data: {},
          shipping_address: shippingInfo,
          shipping_method: shippingMethod,
          payment_status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        configuration_data: {
          configuration: item.configuration,
          configurationDisplay: item.configurationDisplay,
        },
        quantity: item.quantity,
        unit_price: item.totalPrice,
        total_price: item.totalPrice * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      setOrderId(order.id);
      clearCart();
      setStep('confirmation');
      toast.success('Order placed successfully!');
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0 && step !== 'confirmation') {
    navigate('/cart');
    return null;
  }

  if (step === 'confirmation') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <CheckCircle2 className="w-24 h-24 mx-auto text-green-500" />
            <h1 className="text-4xl font-bold">Order Confirmed!</h1>
            <p className="text-xl text-muted-foreground">
              Thank you for your order. We've received it and will start processing it soon.
            </p>
            {orderId && (
              <Card className="p-6 text-left">
                <p className="text-sm text-muted-foreground mb-2">Order ID</p>
                <p className="font-mono text-sm">{orderId}</p>
              </Card>
            )}
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/profile')} size="lg">
                View Orders
              </Button>
              <Button variant="outline" onClick={() => navigate('/products')} size="lg">
                Continue Shopping
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Checkout</h1>

          {/* Progress Steps */}
          <div className="flex justify-between mb-12">
            {['shipping', 'payment', 'review'].map((s, idx) => (
              <div key={s} className="flex-1 flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  ['shipping', 'payment', 'review'].indexOf(step) >= idx
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 h-1 bg-muted mx-2">
                  <div className={`h-full ${
                    ['shipping', 'payment', 'review'].indexOf(step) > idx ? 'bg-primary' : ''
                  }`} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {step === 'shipping' && (
                <Card className="p-6">
                  <h2 className="text-2xl font-bold mb-6">Shipping Information</h2>
                  <form onSubmit={handleShippingSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name *</Label>
                        <Input
                          id="fullName"
                          required
                          value={shippingInfo.fullName}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, fullName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={shippingInfo.email}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address *</Label>
                      <Input
                        id="address"
                        required
                        value={shippingInfo.address}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          required
                          value={shippingInfo.city}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          required
                          value={shippingInfo.state}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, state: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">ZIP Code *</Label>
                        <Input
                          id="zipCode"
                          required
                          value={shippingInfo.zipCode}
                          onChange={(e) => setShippingInfo({ ...shippingInfo, zipCode: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <Input
                        id="country"
                        required
                        value={shippingInfo.country}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, country: e.target.value })}
                      />
                    </div>

                    <Separator className="my-6" />

                    <div className="space-y-4">
                      <Label>Shipping Method</Label>
                      <RadioGroup value={shippingMethod} onValueChange={setShippingMethod}>
                        {shippingOptions.map(option => (
                          <div key={option.id} className="flex items-center space-x-2 border rounded-lg p-4">
                            <RadioGroupItem value={option.id} id={option.id} />
                            <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                              <div className="flex justify-between">
                                <div>
                                  <p className="font-semibold">{option.name}</p>
                                  <p className="text-sm text-muted-foreground">{option.duration}</p>
                                </div>
                                <p className="font-semibold">
                                  {option.price === 0 ? 'Free' : `$${option.price.toFixed(2)}`}
                                </p>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <Button type="submit" className="w-full" size="lg">
                      Continue to Payment
                    </Button>
                  </form>
                </Card>
              )}

              {step === 'payment' && (
                <Card className="p-6">
                  <h2 className="text-2xl font-bold mb-6">Payment Information</h2>
                  <form onSubmit={handlePaymentSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Card Number *</Label>
                      <Input id="cardNumber" placeholder="1234 5678 9012 3456" required />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry">Expiry Date *</Label>
                        <Input id="expiry" placeholder="MM/YY" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvv">CVV *</Label>
                        <Input id="cvv" placeholder="123" required />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cardName">Cardholder Name *</Label>
                      <Input id="cardName" required />
                    </div>

                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={() => setStep('shipping')} className="flex-1">
                        Back
                      </Button>
                      <Button type="submit" className="flex-1">
                        Review Order
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {step === 'review' && (
                <Card className="p-6">
                  <h2 className="text-2xl font-bold mb-6">Review Your Order</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-2">Shipping Address</h3>
                      <p className="text-sm text-muted-foreground">
                        {shippingInfo.fullName}<br />
                        {shippingInfo.address}<br />
                        {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}<br />
                        {shippingInfo.country}
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2">Shipping Method</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedShipping?.name} - {selectedShipping?.duration}
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-4">Order Items</h3>
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <div>
                              <p className="font-medium">{item.productName}</p>
                              <p className="text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                            <p className="font-semibold">${(item.totalPrice * item.quantity).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={() => setStep('payment')} className="flex-1">
                        Back
                      </Button>
                      <Button onClick={handlePlaceOrder} disabled={loading} className="flex-1">
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Place Order'
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-4">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>
                      {selectedShipping?.price === 0 ? 'Free' : `$${selectedShipping?.price.toFixed(2)}`}
                    </span>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>${finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
