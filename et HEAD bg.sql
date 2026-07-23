[1mdiff --git a/bg.sql b/bg.sql[m
[1mnew file mode 100644[m
[1mindex 0000000..5d7dafd[m
[1m--- /dev/null[m
[1m+++ b/bg.sql[m
[36m@@ -0,0 +1,5721 @@[m
[32m+[m[32m--[m
[32m+[m[32m-- PostgreSQL database dump[m
[32m+[m[32m--[m
[32m+[m
[32m+[m[32m-- Dumped from database version 17.5[m
[32m+[m[32m-- Dumped by pg_dump version 17.5[m
[32m+[m
[32m+[m[32m-- Started on 2025-08-25 13:09:31[m
[32m+[m
[32m+[m[32mSET statement_timeout = 0;[m
[32m+[m[32mSET lock_timeout = 0;[m
[32m+[m[32mSET idle_in_transaction_session_timeout = 0;[m
[32m+[m[32mSET transaction_timeout = 0;[m
[32m+[m[32mSET client_encoding = 'UTF8';[m
[32m+[m[32mSET standard_conforming_strings = on;[m
[32m+[m[32mSELECT pg_catalog.set_config('search_path', '', false);[m
[32m+[m[32mSET check_function_bodies = false;[m
[32m+[m[32mSET xmloption = content;[m
[32m+[m[32mSET client_min_messages = warning;[m
[32m+[m[32mSET row_security = off;[m
[32m+[m
[32m+[m[32m--[m
[32m+[m[32m-- TOC entry 918 (class 1247 OID 17086)[m
[32m+[m[32m-- Name: subscription_plan; Type: TYPE; Schema: public; Owner: postgres[m
[32m+[m[32m--[m
[32m+[m
[32m+[m[32mCREATE TYPE public.subscription_plan AS ENUM ([m
[32m+[m[32m    'basic',[m
[32m+[m[32m    'premium',[m
[32m+[m[32m    'enterprise'[m
[32m+[m[32m);[m
[32m+[m
[32m+[m
[32m+[m[32mALTER TYPE public.subscription_plan OWNER TO postgres;[m
[32m+[m
[32m+[m[32m--[m
[32m+[m[32m-- TOC entry 921 (class 1247 OID 17094)[m
[32m+[m[32m-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres[m
[32m+[m[32m--[m
[32m+[m
[32m+[m[32mCREATE TYPE public.user_role AS ENUM ([m
[32m+[m[32m    'super_admin',[m
[32m+[m[32m    'dealer',[m
[32m+[m[32m    'client'[m
[32m+[m[32m);[m
[32m+[m
[32m+[m
[32m+[m[32mALTER TYPE public.user_role OWNER TO postgres;[m
[32m+[m
[32m+[m[32m--[m
[32m+[m[32m-- TOC entry 288 (class 1255 OID 17993)[m
[32m+[m[32m-- Name: import_vehicle_from_csv(uuid, text, text, text, text, text, text, text, text, boolean, text, text, text, text, text, integer, numeric, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric, text, integer, text); Type: FUNCTION; Schema: public; Owner: postgres[m
[32m+[m[32m--[m
[32m+[m
[32m+[m[32mCREATE FUNCTION public.import_vehicle_from_csv(p_dealer_id uuid, p_vin text, p_make text, p_model text, p_series text DEFAULT NULL::text, p_stock_number text DEFAULT NULL::text, p_new_used text DEFAULT 'used'::text, p_body_style text DEFAULT NULL::text, p_vehicle_type text DEFAULT NULL::text, p_certified boolean DEFAULT false, p_color text DEFAULT NULL::text, p_interior_color text DEFAULT NULL::text, p_engine_type text DEFAULT NULL::text, p_displacement text DEFAULT NULL::text, p_features text DEFAULT NULL::text, p_odometer integer DEFAULT NULL::integer, p_price numeric DEFAULT NULL::numeric, p_other_price numeric DEFAULT NULL::numeric, p_transmission text DEFAULT NULL::text, p_msrp numeric DEFAULT NULL::numeric, p_dealer_discount numeric DEFAULT NULL::numeric, p_consumer_rebate numeric DEFAULT NULL::numeric, p_dealer_accessories numeric DEFAULT NULL::numeric, p_total_customer_savings numeric DEFAULT NULL::numeric, p_total_dealer_rebate numeric DEFAULT NULL::numeric, p_photo_url_list text DEFAULT NULL::text, p_year integer DEFAULT NULL::integer, p_reference_dealer_id text DEFAULT NULL::text) RETURNS uuid[m
[32m+[m[32m    LANGUAGE plpgsql[m
[32m+[m[32m    AS $$[m
[32m+[m[32mDECLARE[m
[32m+[m[32m    v_vehicle_id UUID;[m
[32m+[m[32m    v_photo_urls TEXT[];[m
[32m+[m[32mBEGIN[m
[32m+[m[32m    -- Convert photo_url_list from formatted string to array[m
[32m+[m[32m    IF p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN[m
[32m+[m[32m        -- Remove curly brackets and split by comma[m
[32m+[m[32m        v_photo_urls := string_to_array([m
[32m+[m[32m            trim(both '{}' from p_photo_url_list),[m[41m [m
[32m+[m[32m            ','[m
[32m+[m[32m        );[m
[32m+[m[32m        -- Trim whitespace from each URL[m
[32m+[m[32m        SELECT array_agg(trim(url)) INTO v_photo_urls[m[41m [m
[32m+[m[32m        FROM unnest(v_photo_urls) AS url[m[41m [m
[32m+[m[32m        WHERE trim(url) != '';[m
[32m+[m[32m    ELSE[m
[32m+[m[32m        v_photo_urls := NULL;[m
[32m+[m[32m    END IF;[m
[32m+[m
[32m+[m[32m    -- Check if vehicle already exists by VIN[m
[32m+[m[32m    SELECT id INTO v_vehicle_id[m[41m [m
[32m+[m[32m    FROM vehicles[m[41m [m
[32m+[m[32m    WHERE vin = p_vin AND dealer_id = p_dealer_id;[m
[32m+[m
[32m+[m[32m    IF v_vehicle_id IS NOT NULL THEN[m
[32m+[m[32m        -- Update existing vehicle[m
[32m+[m[32m        UPDATE vehicles SET[m
[32m+[m[32m            make = COALESCE(p_make, make),[m
[32m+[m[32m            model = COALESCE(p_model, model),[m
[32m+[m[32m            series = COALESCE(p_series, series),[m
[32m+[m[32m            stock_number = COALESCE(p_stock_number, stock_number),[m
[32m+[m[32m            new_used = COALESCE(p_new_used, new_used),[m
[32m+[m[32m            body_style = COALESCE(p_body_style, body_style),[m
[32m+[m[32m            vehicle_type = COALESCE(p_vehicle_type, vehicle_type),[m
[32m+[m[32m            certified = COALESCE(p_certified, certified),[m
[32m+[m[32m            color = COALESCE(p_color, color),[m
[32m+[m[32m            interior_color = COALESCE(p_interior_color, interior_color),[m
[32m+[m[32m            engine_type = COALESCE(p_engine_type, engine_type),[m
[32m+[m[32m            displacement = COALESCE(p_displacement, displacement),[m
[32m+[m[32m            features = CASE WHEN p_features IS NOT NULL THEN string_to_array(p_features, ',') ELSE features END,[m
[32m+[m[32m            odometer = COALESCE(p_odometer, odometer),[m
[32m+[m[32m            price = COALESCE(p_price, price),[m
[32m+[m[32m            other_price = COALESCE(p_other_price, other_price),[m
[32m+[m[32m            transmission = COALESCE(p_transmission, transmission),[m
[32m+[m[32m            msrp = COALESCE(p_msrp, msrp),[m
[32m+[m[32m            dealer_discount = COALESCE(p_dealer_discount, dealer_discount),[m
[32m+[m[32m            consumer_rebate = COALESCE(p_consumer_rebate, consumer_rebate),[m
[32m+[m[32m            dealer_accessories = COALESCE(p_dealer_accessories, dealer_accessories),[m
[32m+[m[32m            total_customer_savings = COALESCE(p_total_customer_savings, total_customer_savings),[m
[32m+[m[32m            total_dealer_rebate = COALESCE(p_total_dealer_rebate, total_dealer_rebate),[m
[32m+[m[32m            photo_url_list = COALESCE(v_photo_urls, photo_url_list),[m
[32m+[m[32m            year = COALESCE(p_year, year),[m
[32m+[m[32m            reference_dealer_id = COALESCE(p_reference_dealer_id, reference_dealer_id),[m
[32m+[m[32m            updated_at = NOW()[m
[32m+[m[32m        WHERE id = v_vehicle_id;[m
[32m+[m[32m    ELSE[m
[32m+[m[32m        -- Insert new vehicle[m
[32m+[m[32m        INSERT INTO vehicles ([m
[32m+[m[32m            dealer_id, vin, make, model, series, stock_number, new_used, body_style, vehicle_type, certified,[m
[32m+[m[32m            color, interior_color, engine_type, displacement, features, odometer,[m
[32m+[m[32m            price, other_price, transmission, msrp, dealer_discount, consumer_rebate,[m
[32m+[m[32m            dealer_accessories, total_customer_savings, total_dealer_rebate,[m
[32m+[m[32m            photo_url_list, year, import_source, import_date, reference_dealer_id[m
[32m+[m[32m        ) VALUES ([m
[32m+[m[32m            p_dealer_id, p_vin, p_make, p_model, p_series, p_stock_number, p_new_used, p_body_style, p_vehicle_type, p_certified,[m
[32m+[m[32m            p_color, p_interior_color, p_engine_type, p_displacement,[m[41m [m
[32m+[m[32m            CASE WHEN p_features IS NOT NULL THEN string_to_array(p_features, ',') ELSE NULL END,[m
[32m+[m[32m            p_odometer, p_price, p_oth