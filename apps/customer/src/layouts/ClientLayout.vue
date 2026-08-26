<script setup lang="ts">
import { useRouter } from 'vue-router';
import Header from './components/Header.vue';
import Breadcrumb from './components/Breadcrumb.vue';
import Footer from './components/Footer.vue';
import ChatbotOverlay from './components/ChatbotOverlay.vue';
import BookingBasketDrawer from './components/BookingBasketDrawer.vue';
import BookingBasketBar from './components/BookingBasketBar.vue';
import CheckoutOptionModal from '@/Views/Anonymous/CheckoutOptionModal.vue';
import { useBookingBasketStore } from '@/stores/useBookingBasketStore';

const router = useRouter();
const bookingStore = useBookingBasketStore();

const handleCheckoutOption = (payload: { loaiCheckout: string }) => {
    bookingStore.processCheckoutOption(payload.loaiCheckout, router);
};
</script>

<template>
  <div class="flex flex-col min-h-screen w-full relative">


    <Header />
    <Breadcrumb />

    <!-- Main Content Area where child routes are injected -->
    <main class="flex-1 w-full flex flex-col">
      <router-view />
    </main>

    <Footer />
    
    <ChatbotOverlay />
    <BookingBasketDrawer />
    <BookingBasketBar />

    <CheckoutOptionModal 
      :isOpen="bookingStore.showCheckoutOptionModal"
      :hideProductOnly="true"
      @close="bookingStore.showCheckoutOptionModal = false"
      @confirm="handleCheckoutOption"
    />
  </div>
</template>
