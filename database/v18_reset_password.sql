-- =============================================
-- V18 - FUNÇÃO PARA RESETAR SENHA DE USUÁRIO
-- =============================================

-- IMPORTANTE: Esta função requer que você configure no Supabase:
-- 1. Vá em Authentication > Providers > Email
-- 2. Desmarque "Confirm email" se quiser que funcione sem confirmação
-- 3. Execute este SQL no SQL Editor

-- Função para admin resetar senha de um usuário
-- Nota: Por segurança, o Supabase não permite alterar senhas diretamente via SQL
-- A melhor abordagem é usar o Supabase Dashboard ou a API Admin

-- Opção 1: Usar Magic Link (recomendado)
-- O admin pode enviar um link de recuperação para o email do cotista

-- Opção 2: Se o cotista não tem email válido
-- O admin pode:
-- 1. Acessar o Supabase Dashboard
-- 2. Ir em Authentication > Users
-- 3. Encontrar o usuário
-- 4. Clicar nos 3 pontinhos > "Send password recovery"
-- OU
-- 5. Deletar o usuário e criar novamente com nova senha

-- Para facilitar, vamos adicionar um campo para marcar que precisa resetar senha
ALTER TABLE cotistas ADD COLUMN IF NOT EXISTS precisa_resetar_senha BOOLEAN DEFAULT FALSE;

-- Quando o admin marcar este campo, o cotista verá uma mensagem na UserArea
-- pedindo para entrar em contato com o admin

-- Alternativa: Criar Edge Function no Supabase para resetar senha
-- Isso requer configuração adicional no Supabase
