-- Migration: grant super_admin to a user by email
DO $$
DECLARE
  uid UUID;
  target_email TEXT := 'duncanprono47@gmail.com';
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = target_email LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'User with email % not found. No changes applied.', target_email;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    RAISE NOTICE 'Assigned super_admin to user % (email=%).', uid, target_email;
  END IF;
END;
$$ LANGUAGE plpgsql;
