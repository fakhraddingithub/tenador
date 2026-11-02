"use client";

import { Children } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, Pagination } from "swiper/modules";

export default function ProductSwiper({ children, ...props }) {
  return <Swiper {...props} modules={[Navigation, Autoplay, Pagination]}>
    {Children.map(children, child => child && <SwiperSlide className={child.props.className}>{child.props.children}</SwiperSlide>)}
  </Swiper>;
}
