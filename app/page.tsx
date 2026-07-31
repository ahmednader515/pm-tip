"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, BookOpen, ChevronDown, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { HomepageFeatureIconComponent } from "@/lib/homepage-icons";
import { useHomepageSettings } from "@/components/homepage-settings-provider";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { ScrollProgress } from "@/components/scroll-progress";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { localizedField, localizedText } from "@/lib/localized";
import type { Locale } from "@/i18n/config";

// Define types based on Prisma schema
type Course = {
  id: string;
  userId: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type Purchase = {
  id: string;
  userId: string;
  courseId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type CourseWithProgress = Course & {
  chapters: { id: string }[];
  quizzes: { id: string }[];
  purchases: Purchase[];
  progress: number;
};

type StoreProductPublic = {
  id: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  imageUrl?: string | null;
  price: number;
};

export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale() as Locale;
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProductPublic[]>([]);
  const homepage = useHomepageSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [isStoreLoading, setIsStoreLoading] = useState(true);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        // Fetch courses from public API endpoint
        const response = await fetch("/api/courses/public");
        
        if (!response.ok) {
          console.error("Failed to fetch courses:", response.status, response.statusText);
          return;
        }
        
        const data = await response.json();
        console.log("Fetched courses:", data); // Debug log
        setCourses(data);

      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, []);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setIsStoreLoading(true);
        const response = await fetch("/api/store/public");
        if (response.ok) {
          setStoreProducts(await response.json());
        }
      } catch (error) {
        console.error("Error fetching store products:", error);
      } finally {
        setIsStoreLoading(false);
      }
    };

    fetchStore();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowScrollIndicator(entry.isIntersecting);
      },
      {
        threshold: 0.5, // Trigger when 50% of the hero section is visible
      }
    );

    const heroSection = document.getElementById('hero-section');
    if (heroSection) {
      observer.observe(heroSection);
    }

    return () => {
      if (heroSection) {
        observer.unobserve(heroSection);
      }
    };
  }, []);

  const scrollToCourses = () => {
    const coursesSection = document.getElementById('courses-section');
    if (coursesSection) {
      const offset = coursesSection.offsetTop - 80; // Adjust for navbar height
      window.scrollTo({
        top: offset,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="h-full w-full bg-background">
        <Navbar />
        <ScrollProgress />
      {/* Hero Section */}
      <section id="hero-section" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 md:pt-0 bg-gradient-to-t from-brand/25 via-brand/10 to-transparent">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 items-center">
          {/* Image Section - First on mobile */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="relative flex justify-center items-center order-1 md:order-2"
          >
            <div className="relative w-32 h-32 md:w-80 md:h-80 overflow-hidden rounded-full border-4 border-brand/20 shadow-lg bg-background">
              <div className="absolute inset-2 md:inset-4">
                <Image
                  src={homepage.teacherImageUrl}
                  alt={t("brandAlt")}
                  fill
                  priority
                  className="object-contain object-center"
                  sizes="(max-width: 768px) 128px, 288px"
                  unoptimized={homepage.teacherImageUrl.startsWith("/")}
                />
              </div>
            </div>
            
            {/* Floating Stationery Items */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: [0, -15, 0],
                rotate: [0, 5, 0]
              }}
              transition={{ 
                duration: 0.5, 
                delay: 0.5,
                y: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                rotate: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              className="absolute top-1 -right-2"
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              <Image
                src="/graduation-hat.png"
                alt={t("imageAlts.graduationHat")}
                width={50}
                height={50}
                className="object-contain"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: [0, -12, 0],
                rotate: [0, -5, 0]
              }}
              transition={{ 
                duration: 0.5, 
                delay: 0.7,
                y: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                rotate: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              className="absolute bottom-1/3 left-6"
              whileHover={{ scale: 1.1, rotate: -5 }}
            >
              <Image
                src="/medal.png"
                alt={t("imageAlts.medal")}
                width={40}
                height={40}
                className="object-contain"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: [0, -18, 0],
                rotate: [0, 10, 0]
              }}
              transition={{ 
                duration: 0.5, 
                delay: 0.9,
                y: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                rotate: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              className="absolute top-1/2 -right-6"
              whileHover={{ scale: 1.1, rotate: 10 }}
            >
              <Image
                src="/notebook.png"
                alt={t("imageAlts.notebook")}
                width={55}
                height={55}
                className="object-contain"
              />
            </motion.div>
          </motion.div>

          {/* Text Section - Second on mobile */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mt-0 md:mt-0 order-2 md:order-1"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-brand">PM TIPS</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              {t("tagline")}
            </p>
            <Button size="lg" asChild className="bg-brand hover:bg-brand/90 text-white">
              <Link href="/sign-up">
                {t("ctaStart")} <ArrowRight className="mr-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        {showScrollIndicator && (
          <motion.div 
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex-col items-center gap-2 cursor-pointer hidden md:flex"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 1, duration: 0.5 }}
            onClick={scrollToCourses}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="h-8 w-8 text-muted-foreground" />
            </motion.div>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            >
              <ChevronDown className="h-8 w-8 text-muted-foreground" />
            </motion.div>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            >
              <ChevronDown className="h-8 w-8 text-muted-foreground" />
            </motion.div>
          </motion.div>
        )}
      </section>

      {/* Courses Section */}
      <section id="courses-section" className="py-20 bg-muted/50">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="container mx-auto px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">{t("courses.title")}</h2>
            <p className="text-muted-foreground">{t("courses.subtitle")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-6"
          >
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="w-full sm:w-80 md:w-72 lg:w-80 bg-card rounded-xl overflow-hidden border shadow-sm animate-pulse"
                >
                  <div className="w-full aspect-video bg-muted" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : (
              courses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{t("courses.emptyTitle")}</h3>
                    <p className="text-muted-foreground mb-4">
                      {t("courses.emptyDescription")}
                    </p>
                    <Button 
                      variant="outline" 
                      asChild
                      className="bg-brand hover:bg-brand/90 text-white border-brand"
                    >
                      <Link href="/sign-up">
                        {t("courses.earlyAccess")}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                courses.map((course, index) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="group w-full sm:w-80 md:w-72 lg:w-80 bg-card rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="relative w-full aspect-video">
                      <Image
                        src={course.imageUrl || "/placeholder.png"}
                        alt={localizedField(course as unknown as Record<string, unknown>, "title", locale)}
                        fill
                        className="object-cover rounded-t-xl"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                        {localizedField(course as unknown as Record<string, unknown>, "title", locale)}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <BookOpen className="h-4 w-4" />
                        <span>
                          {t("courses.chapterCount", { count: course.chapters?.length || 0 })}
                          {course.quizzes && course.quizzes.length > 0 && (
                            <span className="mr-2">{t("courses.quizCount", { count: course.quizzes.length })}</span>
                          )}
                        </span>
                      </div>
                      <Button 
                        className="w-full bg-brand hover:bg-brand/90 text-white" 
                        variant="default"
                        onClick={() => {
                          if (!session?.user) {
                            router.push("/sign-in");
                            return;
                          }
                          const courseUrl = course.chapters && course.chapters.length > 0 
                            ? `/courses/${course.id}/chapters/${course.chapters[0].id}` 
                            : `/courses/${course.id}`;
                          router.push(courseUrl);
                        }}
                      >
                        {t("courses.viewCourse")}
                      </Button>
                    </div>
                  </motion.div>
                ))
              )
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Store Section */}
      <section id="store-section" className="py-20">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="container mx-auto px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">{t("store.title")}</h2>
            <p className="text-muted-foreground">{t("store.subtitle")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-6"
          >
            {isStoreLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="w-full sm:w-80 md:w-72 lg:w-80 bg-card rounded-xl overflow-hidden border shadow-sm animate-pulse"
                >
                  <div className="w-full aspect-video bg-muted" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : storeProducts.length === 0 ? (
              <div className="text-center py-12 w-full">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t("store.emptyTitle")}</h3>
                  <p className="text-muted-foreground">
                    {t("store.emptyDescription")}
                  </p>
                </div>
              </div>
            ) : (
              storeProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group w-full sm:w-80 md:w-72 lg:w-80 bg-card rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-all"
                >
                  <div className="relative w-full aspect-video">
                    <Image
                      src={product.imageUrl || "/placeholder.png"}
                      alt={localizedField(product as unknown as Record<string, unknown>, "title", locale)}
                      fill
                      className="object-cover rounded-t-xl"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2 line-clamp-2">
                      {localizedField(product as unknown as Record<string, unknown>, "title", locale)}
                    </h3>
                    {localizedField(product as unknown as Record<string, unknown>, "description", locale) && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {localizedField(product as unknown as Record<string, unknown>, "description", locale)}
                      </p>
                    )}
                    <p className="text-lg font-semibold text-primary mb-4">
                      {formatPrice(product.price)}
                    </p>
                    <Button
                      className="w-full bg-brand hover:bg-brand/90 text-white"
                      onClick={() => {
                        if (!session?.user) {
                          router.push("/sign-in");
                          return;
                        }
                        router.push("/dashboard/store");
                      }}
                    >
                      {session?.user ? t("store.viewInStore") : t("store.signInToBuy")}
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("testimonials.title")}</h2>
            <p className="text-muted-foreground">{t("testimonials.subtitle")}</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homepage.testimonials.map((testimonial, index) => {
              const name = localizedText(testimonial.name, locale);
              const grade = localizedText(testimonial.grade, locale);
              const quote = localizedText(testimonial.testimonial, locale);
              return (
              <motion.div
                key={`${name}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-card rounded-lg p-6 shadow-lg"
              >
                <div className="flex items-center mb-4">
                  <div className="relative h-12 w-12 rounded-full overflow-hidden">
                    <Image
                      src={testimonial.avatarUrl || "/male.png"}
                      alt={name}
                      fill
                      className="object-cover"
                      unoptimized={(testimonial.avatarUrl || "/male.png").startsWith("/")}
                    />
                  </div>
                  <div className="mr-4">
                    <h4 className="font-semibold">{name}</h4>
                    <p className="text-sm text-muted-foreground">{grade}</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  &ldquo;{quote}&rdquo;
                </p>
                <div className="flex mt-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/50">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="container mx-auto px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">{t("features.title")}</h2>
            <p className="text-muted-foreground">{t("features.subtitle")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {homepage.features.map((feature, index) => {
              const title = localizedText(feature.title, locale);
              const description = localizedText(feature.description, locale);
              return (
              <motion.div
                key={`${title}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                className="text-center p-6 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HomepageFeatureIconComponent icon={feature.icon} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
              </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("cta.title")}</h2>
            <p className="text-muted-foreground mb-8">
              {t("cta.subtitle")}
            </p>
            <Button size="lg" asChild className="bg-brand hover:bg-brand/90 text-white">
              <Link href="/sign-up">
                {t("cta.button")} <ArrowRight className="mr-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
      </div>
  );
}
