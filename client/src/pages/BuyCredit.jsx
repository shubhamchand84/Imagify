import React, { useContext } from 'react';
import { assets, plans } from '../assets/assets';
import { AppContext } from '../context/AppContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

const BuyCredit = () => {
  const { user, backendUrl, loadCreditsData, token, setShowLogin } = useContext(AppContext);
  const navigate = useNavigate();

  const initPay = async (order) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: "Credits Payment",
      description: "Credits Payment",
      order_id: order.id,
      handler: async (response) => {
        try {
          const { data } = await axios.post(
            backendUrl + '/api/user/verify-razor',
            { order_id: response.razorpay_order_id },
            { headers: { token } }
          );

          if (data.success) {
            loadCreditsData();
            navigate('/');
            toast.success('Credits Added Successfully');
          } else {
            toast.error(data.message || 'Verification failed');
          }
        } catch (error) {
          toast.error(error.message || 'Payment verification error');
        }
      },
      theme: {
        color: "#1f2937" // Optional styling
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const paymentRazorpay = async (planId) => {
    if (!user) {
      setShowLogin(true);
      return;
    }

    try {
      const { data } = await axios.post(
        backendUrl + '/api/user/pay-razor',
        { planId },
        { headers: { token } }
      );

      if (data.success) {
        initPay(data.order);
      } else {
        toast.error(data.message || 'Failed to initiate payment');
      }
    } catch (error) {
      toast.error(error.message || 'Something went wrong');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0.2, y: 100 }}
      transition={{ duration: 1 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className='min-h-[80vh] text-center pt-14 mb-10'
    >
      <button className='border border-gray-400 px-10 py-2 rounded-full mb-6'>OUR PLANS</button>
      <h1 className='text-center text-3xl font-medium mb-6 sm:mb-10'>Choose the plan</h1>

      <div className='flex flex-wrap justify-center gap-6 text-left'>
        {plans.map((items, index) => (
          <div
            key={index}
            className='bg-white drop-shadow-sm border rounded-lg py-12 px-8 text-gray-600 hover:scale-105 transition-all duration-500'
          >
            <img width={40} src={assets.logo_icon} alt="plan icon" />
            <p className='mt-3 mb-1 font-semibold'>{items.id}</p>
            <p className='text-sm'>{items.desc}</p>
            <p className='mt-6'>
              <span className='text-3xl font-medium'>${items.price}</span> / {items.credits} credits
            </p>
            <button
              onClick={() => paymentRazorpay(items.id)}
              className="w-full bg-gray-800 text-white mt-8 text-sm rounded-md py-2.5 min-w-52"
            >
              {user ? 'Purchase' : 'Get Started'}
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default BuyCredit;


