-- =============================================
-- CAIXINHA 2026 - SCHEMA SUPABASE
-- Base limpa - Apenas estrutura
-- =============================================

-- Limpar tabelas existentes (se houver)
DROP TABLE IF EXISTS auditoria CASCADE;
DROP TABLE IF EXISTS notificacoes CASCADE;
DROP TABLE IF EXISTS configuracoes CASCADE;
DROP TABLE IF EXISTS cdi CASCADE;
DROP TABLE IF EXISTS rifas CASCADE;
DROP TABLE IF EXISTS pagamentos_emprestimo CASCADE;
DROP TABLE IF EXISTS emprestimos CASCADE;
DROP TABLE IF EXISTS mensalidades CASCADE;
DROP TABLE IF EXISTS cotistas CASCADE;

-- =============================================
-- TABELA: COTISTAS
-- =============================================
CREATE TABLE cotistas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    cotas INTEGER NOT NULL DEFAULT 1 CHECK (cotas >= 1 AND cotas <= 50),
    is_admin BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'pendente')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_nome UNIQUE (nome),
    CONSTRAINT unique_email UNIQUE (email)
);

-- Índices
CREATE INDEX idx_cotistas_user_id ON cotistas(user_id);
CREATE INDEX idx_cotistas_status ON cotistas(status);
CREATE INDEX idx_cotistas_nome ON cotistas(nome);

-- =============================================
-- TABELA: MENSALIDADES
-- =============================================
CREATE TABLE mensalidades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cotista_id UUID NOT NULL REFERENCES cotistas(id) ON DELETE CASCADE,
    mes_referencia VARCHAR(7) NOT NULL, -- Formato: '2026-01'
    valor_devido DECIMAL(10,2) NOT NULL,
    valor_pago DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'parcial', 'pago', 'atrasado')),
    data_pagamento TIMESTAMP WITH TIME ZONE,
    data_vencimento DATE,
    comprovante_url TEXT,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_cotista_mes UNIQUE (cotista_id, mes_referencia)
);

-- Índices
CREATE INDEX idx_mensalidades_cotista ON mensalidades(cotista_id);
CREATE INDEX idx_mensalidades_mes ON mensalidades(mes_referencia);
CREATE INDEX idx_mensalidades_status ON mensalidades(status);

-- =============================================
-- TABELA: EMPRÉSTIMOS
-- =============================================
CREATE TABLE emprestimos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cotista_id UUID NOT NULL REFERENCES cotistas(id) ON DELETE CASCADE,
    valor_emprestimo DECIMAL(10,2) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('vista', 'parcelado')),
    parcelas INTEGER DEFAULT 1 CHECK (parcelas >= 1 AND parcelas <= 3),
    taxa_juros DECIMAL(5,2) NOT NULL,
    valor_juros DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    valor_parcela DECIMAL(10,2),
    parcelas_pagas INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'ativo', 'pago', 'cancelado')),
    motivo TEXT,
    aprovado_por UUID REFERENCES cotistas(id),
    data_aprovacao TIMESTAMP WITH TIME ZONE,
    data_quitacao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_emprestimos_cotista ON emprestimos(cotista_id);
CREATE INDEX idx_emprestimos_status ON emprestimos(status);

-- =============================================
-- TABELA: PAGAMENTOS DE EMPRÉSTIMO
-- =============================================
CREATE TABLE pagamentos_emprestimo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    emprestimo_id UUID NOT NULL REFERENCES emprestimos(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    comprovante_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABELA: RIFAS
-- =============================================
CREATE TABLE rifas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data DATE NOT NULL,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABELA: CDI (Rendimentos)
-- =============================================
CREATE TABLE cdi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mes_referencia VARCHAR(7) NOT NULL UNIQUE, -- Formato: '2026-01'
    valor DECIMAL(10,2) NOT NULL,
    taxa_percentual DECIMAL(5,4),
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABELA: CONFIGURAÇÕES
-- =============================================
CREATE TABLE configuracoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chave VARCHAR(50) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    descricao TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABELA: NOTIFICAÇÕES
-- =============================================
CREATE TABLE notificacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cotista_id UUID NOT NULL REFERENCES cotistas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT,
    lida BOOLEAN DEFAULT FALSE,
    data_leitura TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_notificacoes_cotista ON notificacoes(cotista_id);
CREATE INDEX idx_notificacoes_lida ON notificacoes(lida);

-- =============================================
-- TABELA: AUDITORIA
-- =============================================
CREATE TABLE auditoria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID REFERENCES cotistas(id),
    acao VARCHAR(100) NOT NULL,
    tabela VARCHAR(50),
    registro_id UUID,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_created ON auditoria(created_at);

-- =============================================
-- VIEWS
-- =============================================

-- View: Resumo dos cotistas
CREATE OR REPLACE VIEW vw_resumo_cotistas AS
SELECT 
    c.id,
    c.nome,
    c.email,
    c.cotas,
    c.is_admin,
    c.status,
    COALESCE(SUM(m.valor_pago), 0) as total_pago,
    COALESCE(SUM(m.valor_devido), 0) as total_devido,
    COALESCE(SUM(m.valor_devido) - SUM(m.valor_pago), 0) as saldo_devedor
FROM cotistas c
LEFT JOIN mensalidades m ON c.id = m.cotista_id
WHERE c.status = 'ativo'
GROUP BY c.id, c.nome, c.email, c.cotas, c.is_admin, c.status;

-- View: Empréstimos ativos
CREATE OR REPLACE VIEW vw_emprestimos_ativos AS
SELECT 
    e.*,
    c.nome as cotista_nome,
    c.cotas as cotista_cotas
FROM emprestimos e
JOIN cotistas c ON e.cotista_id = c.id
WHERE e.status IN ('ativo', 'pendente', 'aprovado');

-- =============================================
-- TRIGGERS
-- =============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de updated_at
CREATE TRIGGER tr_cotistas_updated
    BEFORE UPDATE ON cotistas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_mensalidades_updated
    BEFORE UPDATE ON mensalidades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_emprestimos_updated
    BEFORE UPDATE ON emprestimos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS
ALTER TABLE cotistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdi ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas para COTISTAS
CREATE POLICY "Cotistas: Todos podem ver ativos" ON cotistas
    FOR SELECT USING (status = 'ativo');

CREATE POLICY "Cotistas: Admin pode tudo" ON cotistas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Cotistas: Usuário pode ver próprio" ON cotistas
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Cotistas: Usuário pode atualizar próprio" ON cotistas
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Cotistas: Permitir insert para novos usuários" ON cotistas
    FOR INSERT WITH CHECK (true);

-- Políticas para MENSALIDADES
CREATE POLICY "Mensalidades: Todos podem ver" ON mensalidades
    FOR SELECT USING (true);

CREATE POLICY "Mensalidades: Admin pode tudo" ON mensalidades
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- Políticas para EMPRÉSTIMOS
CREATE POLICY "Emprestimos: Cotista vê próprios" ON emprestimos
    FOR SELECT USING (
        cotista_id IN (SELECT id FROM cotistas WHERE user_id = auth.uid())
    );

CREATE POLICY "Emprestimos: Admin pode tudo" ON emprestimos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Emprestimos: Cotista pode solicitar" ON emprestimos
    FOR INSERT WITH CHECK (
        cotista_id IN (SELECT id FROM cotistas WHERE user_id = auth.uid())
    );

-- Políticas para RIFAS
CREATE POLICY "Rifas: Todos podem ver" ON rifas
    FOR SELECT USING (true);

CREATE POLICY "Rifas: Admin pode tudo" ON rifas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- Políticas para CDI
CREATE POLICY "CDI: Todos podem ver" ON cdi
    FOR SELECT USING (true);

CREATE POLICY "CDI: Admin pode tudo" ON cdi
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- Políticas para NOTIFICAÇÕES
CREATE POLICY "Notificacoes: Cotista vê próprias" ON notificacoes
    FOR SELECT USING (
        cotista_id IN (SELECT id FROM cotistas WHERE user_id = auth.uid())
    );

CREATE POLICY "Notificacoes: Cotista atualiza próprias" ON notificacoes
    FOR UPDATE USING (
        cotista_id IN (SELECT id FROM cotistas WHERE user_id = auth.uid())
    );

CREATE POLICY "Notificacoes: Admin pode tudo" ON notificacoes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- Políticas para CONFIGURAÇÕES
CREATE POLICY "Config: Todos podem ver" ON configuracoes
    FOR SELECT USING (true);

CREATE POLICY "Config: Admin pode tudo" ON configuracoes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- =============================================
-- CONFIGURAÇÕES INICIAIS
-- =============================================
INSERT INTO configuracoes (chave, valor, descricao) VALUES
    ('valor_por_cota', '50', 'Valor mensal por cota em reais'),
    ('juros_vista', '20', 'Taxa de juros para empréstimo à vista (%)'),
    ('juros_parcelado', '30', 'Taxa de juros para empréstimo parcelado (%)'),
    ('limite_emprestimo_percent', '80', 'Percentual máximo do investido para empréstimo'),
    ('pix_chave', 'diegovirgilio@gmail.com', 'Chave PIX para pagamentos'),
    ('pix_nome', 'Virgilio Administrador', 'Nome do titular do PIX'),
    ('ano_referencia', '2026', 'Ano de referência da caixinha'),
    ('mes_inicio', '01', 'Mês de início'),
    ('mes_fim', '11', 'Mês de encerramento');

-- =============================================
-- FIM DO SCHEMA
-- =============================================
